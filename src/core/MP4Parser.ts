import { BoxInfo } from "../types/box";

export class MP4Parser {
  private readonly data: Uint8Array;
  public readonly offset: number;
  public readonly size: number;
  public readonly type: string;
  public readonly headerSize: number;

  constructor(data: Uint8Array, offset: number = 0) {
    this.data = data;
    this.offset = offset;

    const view = new DataView(data.buffer, data.byteOffset + offset);
    this.size = view.getUint32(0);
    this.type = this.parseType(data, offset + 4);
    if (this.size === 1) {
      const high = view.getUint32(8);
      const low = view.getUint32(12);
      this.size = high * 0x100000000 + low;
      this.headerSize = 16;
    } else {
      this.headerSize = 8;
    }
  }

  private parseType(data: Uint8Array, offset: number) {
    return String.fromCharCode(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      data[offset + 3]
    );
  }

  public getData(): Uint8Array {
    return this.data.slice(this.offset, this.offset + this.size);
  }

  public getContent(): Uint8Array {
    return this.data.slice(
      this.offset + this.headerSize,
      this.offset + this.size
    );
  }

  public getInfo(): BoxInfo {
    return {
      size: this.size,
      type: this.type,
      offset: this.offset,
      headerSize: this.headerSize,
    };
  }
}
