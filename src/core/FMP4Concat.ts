import { MP4Parser } from "./MP4Parser";

export class FMP4Concat {
  // 记录第一个m3u8的基准时间（用于第一次开播的相对时间计算）
  private firstBaseTimes: Record<number, number> = {};

  // 记录上一个处理过的 baseTime
  private previousBaseTimes: Record<number, number> = {};

  // 记录多个 m3u8 累积的 baseTime（多个 m3u8 的累积偏移）
  private cumulativeOffsets: Record<number, number> = {};

  // 记录当前处在第几个 m3u8，用于判断是否是第一个 m3u8
  private streamSessions: Record<number, number> = {};

  //当前 m3u8 baseTime 的最大值
  private sessionMaxTime: Record<number, number> = {};

  public concat(
    streams: ReadableStream<Uint8Array>[]
  ): ReadableStream<Uint8Array> {
    const self = this;

    return new ReadableStream({
      async start(controller) {
        try {
          // 逐个处理每个输入流
          for (const stream of streams) {
            const reader = stream.getReader();
            let buffer = new Uint8Array(0); //累积缓冲区
            while (true) {
              const { done, value } = await reader.read();
              if (value) {
                // 将新数据追加到缓冲区
                const newBuffer = new Uint8Array(buffer.length + value.length);
                newBuffer.set(buffer);
                newBuffer.set(value, buffer.length);
                buffer = newBuffer;

                // 处理缓冲区中的完整盒子;
                const result = self.processBoxesInPlace(buffer);
                if (result.processedData.length > 0) {
                  controller.enqueue(result.processedData);
                }
                buffer = result.remainingBuffer;
              }
              if (done) {
                // 流结束时处理剩余数据
                if (buffer.length > 0) {
                  const processed = self.processBoxesInPlace(buffer, true);
                  if (processed.processedData.length > 0) {
                    controller.enqueue(processed.processedData);
                  }
                }
                reader.releaseLock();
                break;
              }
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  private processBoxesInPlace(
    buffer: Uint8Array,
    forceProcess: boolean = false
  ) {
    let offset = 0;
    let lastCompleteBoxEnd = 0;
    // 创建输出数据的副本
    const outputData = new Uint8Array(buffer);
    while (offset < buffer.length) {
      // 检查是否有足够的数据读取盒子头部
      if (offset + 8 > buffer.length) break;
      const box = new MP4Parser(buffer, offset);
      const boxEnd = offset + box.size;

      // 因为是 Stream，所以需要检查盒子是否完整
      if (boxEnd > buffer.length && !forceProcess) {
        // Box 不完整，等待更多数据
        break;
      }

      // 如果是 moof box，处理其中的时间戳
      if (box.type === "moof") {
        this.processMoofBox(outputData, offset, box);
      }
      lastCompleteBoxEnd = Math.min(boxEnd, buffer.length);
      offset = boxEnd;
    }

    /// 返回已处理的完整盒子数据和剩余的不完整数据
    if (lastCompleteBoxEnd > 0 || forceProcess) {
      return {
        processedData: outputData.slice(0, lastCompleteBoxEnd),
        remainingBuffer: buffer.slice(lastCompleteBoxEnd),
      };
    }

    return {
      processedData: new Uint8Array(0),
      remainingBuffer: buffer,
    };
  }

  private processMoofBox(
    data: Uint8Array,
    moofOffset: number,
    moofBox: MP4Parser
  ) {
    const moofContent = moofBox.getContent();
    // 查找所有traf box
    const trafBoxes = this.findBoxes(moofContent, "traf");

    // 一般存在音轨和视频轨，所以需要遍历所有traf box，之后分别进行修改对应的时间
    for (const trafBox of trafBoxes) {
      const trafContent = trafBox.getContent();
      // 查找 tfhd 盒子以获取 trackId
      const tfhdBoxes = this.findBoxes(trafContent, "tfhd");
      if (tfhdBoxes.length === 0) continue;

      const tfhdContent = tfhdBoxes[0].getContent();
      const tfhdView = new DataView(tfhdContent.buffer, tfhdContent.byteOffset);
      // 位于TFHD盒子内容的第4-7字节，为trackId
      const trackId = tfhdView.getUint32(4);

      // 查找 tfdt 盒子
      const tfdtBoxes = this.findBoxes(trafContent, "tfdt");
      if (tfdtBoxes.length === 0) continue;

      const tfdtBox = tfdtBoxes[0];
      const { baseTime } = this.parseTfdt(tfdtBox);

      // 初始化轨道信息
      if (!(trackId in this.streamSessions)) {
        this.streamSessions[trackId] = 1;
        this.firstBaseTimes[trackId] = baseTime;
        this.cumulativeOffsets[trackId] = 0;
        this.sessionMaxTime[trackId] = 0;
      }

      let newBaseTime = baseTime;

      if (this.previousBaseTimes[trackId] !== undefined) {
        if (baseTime < this.previousBaseTimes[trackId]) {
          this.cumulativeOffsets[trackId] = this.sessionMaxTime[trackId];
          this.streamSessions[trackId]++;
        }
      }

      if (this.streamSessions[trackId] === 1) {
        // 第一个 m3u8：减去首个基准时间
        newBaseTime = baseTime - this.firstBaseTimes[trackId];
      } else {
        // 后续 m3u8： 加上累积偏移量
        newBaseTime = baseTime + this.cumulativeOffsets[trackId];
      }

      this.sessionMaxTime[trackId] = Math.max(
        this.sessionMaxTime[trackId],
        newBaseTime
      );
      this.previousBaseTimes[trackId] = baseTime;

      const newTfdtData = this.updateTfdt(tfdtBox, newBaseTime);

      const tfdtGlobalOffset =
        moofOffset + // MOOF盒子起始位置
        moofBox.headerSize + // MOOF盒子头部大小
        trafBox.offset + // TRAF盒子相对偏移
        trafBox.headerSize + // TRAF盒子头部大小
        tfdtBox.offset; // TFDT盒子相对偏移

      data.set(newTfdtData, tfdtGlobalOffset);
    }
  }

  private parseTfdt(tfdtBox: MP4Parser) {
    const content = tfdtBox.getContent();
    const version = content[0]; // 版本号在第一个字节

    const view = new DataView(content.buffer, content.byteOffset);
    let baseTime: number;
    if (version === 0) {
      // 32位时间戳（第4-7字节）
      baseTime = view.getUint32(4);
    } else {
      // 64位时间戳（第4-11字节）
      const high = view.getUint32(4);
      const low = view.getUint32(8);
      baseTime = high * 0x100000000 + low;
    }
    return { version, baseTime };
  }

  private updateTfdt(tfdtBox: MP4Parser, newBaseTime: number): Uint8Array {
    const content = tfdtBox.getContent();
    const newContent = new Uint8Array(content);
    const version = content[0];
    const view = new DataView(newContent.buffer, newContent.byteOffset);
    if (version === 0) {
      // 32位版本：直接写入新时间
      if (newBaseTime > 0xffffffff) {
        // 超出32位最大值时的处理
        view.setUint32(4, newBaseTime >>> 0);
      } else {
        view.setUint32(4, newBaseTime);
      }
    } else {
      // 64位版本：分别写入高低32位
      const high = Math.floor(newBaseTime / 0x100000000); // 高32位
      const low = newBaseTime >>> 0; // 使用无符号右移获取低32位
      view.setUint32(4, high);
      view.setUint32(8, low);
    }

    // 重新组装完整的盒子（头部 + 更新后的内容）
    const headers = tfdtBox.getData().slice(0, tfdtBox.headerSize);
    const result = new Uint8Array(headers.length + newContent.length);
    result.set(headers, 0);
    result.set(newContent, headers.length);
    return result;
  }

  private findBoxes(
    data: Uint8Array,
    boxType: string,
    start: number = 0,
    end?: number
  ): MP4Parser[] {
    const boxes: MP4Parser[] = [];
    let offset = start;
    const dataEnd = end ?? data.length;

    while (offset < dataEnd) {
      if (offset + 8 > dataEnd) break;
      const box = new MP4Parser(data, offset);
      if (box.type === boxType) {
        boxes.push(box);
      }
      offset += box.size;
    }
    return boxes;
  }
}
