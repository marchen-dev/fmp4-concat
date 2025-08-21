# fmp4-concat

A browser library for concatenating multiple FMP4 (Fragmented MP4) streams with automatic timeline adjustment.

## Features

- 🎬 Concatenate multiple FMP4 streams seamlessly
- ⏰ Automatic timeline adjustment using TFDT (Track Fragment Decode Time)
- 🌐 Browser-optimized with ReadableStream support
- 📦 Zero dependencies
- 🔧 TypeScript support

## Installation

```bash
npm install fmp4-concat
```

## Usage

### Basic Example

```typescript
import { FMP4Concat } from 'fmp4-concat';

// Create a new FMP4Concat instance
const concat = new FMP4Concat();

// Prepare your FMP4 streams (ReadableStream<Uint8Array>[])
const streams = [stream1, stream2, stream3];

// Concatenate the streams
const concatenatedStream = concat.concat(streams);

// Use the concatenated stream
const reader = concatenatedStream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process the concatenated FMP4 data
  processData(value);
}
```

### Advanced Usage with MP4Parser

```typescript
import { FMP4Concat, MP4Parser } from 'fmp4-concat';

const parser = new MP4Parser();
const concat = new FMP4Concat();

// Parse MP4 boxes for debugging or analysis
const boxInfo = parser.parseBox(uint8ArrayData, 0);
console.log('Box type:', boxInfo.type);
console.log('Box size:', boxInfo.size);

// Then concatenate your streams
const result = concat.concat(streams);
```

## API Reference

### FMP4Concat

#### `concat(streams: ReadableStream<Uint8Array>[]): ReadableStream<Uint8Array>`

Concatenates multiple FMP4 streams with automatic timeline adjustment.

**Parameters:**
- `streams` - Array of ReadableStream containing FMP4 data

**Returns:**
- `ReadableStream<Uint8Array>` - Concatenated FMP4 stream

### MP4Parser

#### `parseBox(buffer: Uint8Array, offset: number): BoxInfo`

Parses an MP4 box from a buffer.

**Parameters:**
- `buffer` - Uint8Array containing MP4 data
- `offset` - Starting position in the buffer

**Returns:**
- `BoxInfo` - Information about the parsed box

## Types

```typescript
interface BoxInfo {
  type: string;
  size: number;
  // ... other box properties
}

interface MoofInfo {
  // Movie fragment information
}

interface TracKInfo {
  // Track information
}
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Suemor