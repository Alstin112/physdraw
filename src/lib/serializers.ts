type Type8Array = Float64Array | BigUint64Array;
type Type4Array = Float32Array | Uint32Array | Int32Array;
type Type2Array = Float16Array | Uint16Array | Int16Array;
type Type1Array = Uint8Array | Int8Array | Uint8ClampedArray;
type TypeArray = Type8Array | Type4Array | Type2Array | Type1Array;



export class Serializer {
    index = 0;
    buffer: ArrayBuffer;
    dataView: DataView;
    STRING_LENGTH_THRESHOLD = 1024;
    

    decoder = new TextDecoder();
    encoder = new TextEncoder();
    
    constructor(buffer: ArrayBuffer = new ArrayBuffer(32)) {
        this.buffer = buffer;
        this.dataView = new DataView(this.buffer);
    }

    getFullUintArray() {
        return new Uint8Array(this.buffer,0, this.index);
    }

    getBuffer() {
        return this.buffer.slice(0, this.index);
    }

    // #region Stream
    maxSize?: number;
    onFlush?: (chunk: Uint8Array<ArrayBuffer>) => void;
    stream?: ReadableStream;
    controller?: ReadableStreamDefaultController<Uint8Array<ArrayBufferLike>>
    static createStream(onFlush: (chunk: Uint8Array<ArrayBuffer>) => void, maxSize: number = 64*1024) {
        const serializer = new Serializer();
        serializer.maxSize = maxSize;
        serializer.onFlush = onFlush;
        return serializer;
    }
    public startReadStream(options?: { compress?: 'deflate' | 'gzip' | 'deflate-raw' }): ReadableStream<Uint8Array> {
        if(this.onFlush) throw new Error("stream already been instantiated");
        this.onFlush = (chunk) => this.controller!.enqueue(chunk);
        if(!this.maxSize) this.maxSize = 64*1024;
        this.index = 0;
        this.stream = new ReadableStream<Uint8Array>({
            start: (controller) => {
                this.controller = controller;
            }
        });
        if (options?.compress) {
            return this.stream.pipeThrough(new CompressionStream(options.compress));
        }

        return this.stream;
    }
    // todo
    public endStream(): void {
        this.flush();
        if (this.controller) {
            this.controller.close();
            this.controller = undefined;
            this.stream = undefined;
            this.onFlush = undefined;
        }
    }
    public flush(): void {
        if (this.index === 0 || !this.onFlush) return;
        const chunk = new Uint8Array(this.buffer.slice(0, this.index));
        this.onFlush(chunk);
        this.index = 0;
    }
    // #endregion Stream

    // #region Readers
    static fromSize(size: number) {
        return new Serializer(new ArrayBuffer(size));
    }
    doubleBuffer(){
        this.buffer = this.buffer.transfer(this.buffer.byteLength<<1);
        this.dataView = new DataView(this.buffer);
        return this;
    }
    public cantFit(bytes: number): boolean {
        return this.index + bytes > this.buffer.byteLength;
    }
    private ensureCapacity(byteLength: number): void {
        if(this.maxSize && this.index+byteLength>this.maxSize) {
            this.flush();
        }
        while (this.index + byteLength > this.buffer.byteLength) {
            this.doubleBuffer();
        }
    }
    readUint(bytes: 1 | 2 | 3 | 4 | 5 | 6) {
        switch(bytes) {
            case 1: {
                const value = this.dataView.getUint8(this.index);
                this.index +=1;
                return value;
            }
            case 2: {
                const value = this.dataView.getUint16(this.index, true);
                this.index +=2;
                return value;
            }
            case 3: {
                let value = this.dataView.getUint8(this.index);
                value |= this.dataView.getUint16(this.index+1, true) << 8;
                this.index +=3;
                return value;
            }
            case 4: {
                const value = this.dataView.getUint32(this.index, true);
                this.index +=4;
                return value;
            }
            case 5: {
                let value = this.dataView.getUint8(this.index);
                value += this.dataView.getUint32(this.index+1, true) * 0x100;
                this.index +=5;
                return value;
            }
            case 6: {
                let value = this.dataView.getUint16(this.index, true);
                value += this.dataView.getUint32(this.index+2, true) * 0x10000;
                this.index += 6;
                return value;
            }
            default: {
                throw new RangeError("Byte size out of the scope");
            }
        }
    }
    readUint8(): number {
        const value = this.dataView.getUint8(this.index);
        this.index += 1;
        return value;
    }
    readUint16(): number {
        const value = this.dataView.getUint16(this.index, true);
        this.index += 2;
        return value;
    }
    readUint24(): number {
        let value = this.dataView.getUint8(this.index);
        value |= this.dataView.getUint16(this.index+1, true) << 8;
        this.index += 3;
        return value
    }
    readUint32(): number {
        const value = this.dataView.getUint32(this.index, true);
        this.index += 4;
        return value;
    }
    readUint64(): bigint {
        const value = this.dataView.getBigUint64(this.index, true);
        this.index += 8;
        return value;
    }
    readFloat64(): number {
        const value = this.dataView.getFloat64(this.index, true);
        this.index += 8;
        return value;
    }
    readString(length: number): string {
        const bytes = new Uint8Array(this.dataView.buffer, this.index, length);
        const value = this.decoder.decode(bytes);
        this.index += length;
        return value;
    }
    readStringIndexed(byteSize: 1 | 2 | 3 | 4 | 5 | 6): string {
        return this.readString(this.readUint(byteSize));
    }
    readBytes(length: number): Readonly<Uint8Array> {
        const bytes = new Uint8Array(this.dataView.buffer, this.index, length);
        this.index += length;
        return bytes;
    }
    readArray(length: number, readElement: (this: this, length: number, index: number) => any): any[] {
        const array = [];
        for (let i = 0; i < length; i++) {
            array.push(readElement.call(this, length, i));
        }
        return array;
    }
    readToTypedArray<T extends TypeArray>(type: T): Readonly<T> {
        const bytes = this.readBytes(type.byteLength);
        new Uint8Array(type.buffer,type.byteOffset,type.byteLength).set(bytes);
        return type;
    }
    // #endregion Readers

    // #region Writers
    writeUint(value: number, bytes: number): void {
        this.ensureCapacity(bytes);
        switch(bytes) {
            case 1: {
                this.dataView.setUint8(this.index,value);
                break;
            }
            case 2: {
                this.dataView.setUint16(this.index,value, true);
                break;
            }
            case 3: {
                this.dataView.setUint8(this.index,value);
                this.dataView.setUint16(this.index+1,value>>8, true);
                break;
            }
            case 4: {
                this.dataView.setUint32(this.index,value, true);
                break;
            }
            case 5: {
                this.dataView.setUint8(this.index,value);
                this.dataView.setUint32(this.index+1,value/0x100, true);
                break;
            }
            case 6: {
                this.dataView.setUint16(this.index,value, true);
                this.dataView.setUint32(this.index+2,value/0x10000, true);
                break;
            }
            default: throw new RangeError("Bytes out of the scope (1-6)");
            
        }
        this.index+=bytes;
    }
    writeUint8(value: number): void {
        this.ensureCapacity(1);
        this.dataView.setUint8(this.index, value);
        this.index += 1;
    }
    writeUint16(value: number): void {
        this.ensureCapacity(2);
        this.dataView.setUint16(this.index, value, true);
        this.index += 2;
    }
    writeUint24(value: number): void {
        this.ensureCapacity(3);
        this.dataView.setUint8(this.index, value);
        this.dataView.setUint16(this.index+1, value >> 8, true);
        this.index += 3;
    }
    writeUint32(value: number): void {
        this.ensureCapacity(4);
        this.dataView.setUint32(this.index, value, true);
        this.index += 4;
    }
    writeUint64(value: bigint): void {
        this.ensureCapacity(8);
        this.dataView.setBigUint64(this.index, value, true);
        this.index += 8;
    }
    writeFloat64(value: number): void {
        this.ensureCapacity(8);
        this.dataView.setFloat64(this.index, value, true);
        this.index += 8;
    }
    writeBytes(value: Uint8Array): void {
        this.ensureCapacity(value.length);
        new Uint8Array(this.buffer, this.index, value.length).set(value);
        this.index += value.length;
    }
    writeString(value: string): void {
        if(value.length < this.STRING_LENGTH_THRESHOLD) {
            this.ensureCapacity(value.length*3);
            const dest = new Uint8Array(this.buffer, this.index);
            const {written} = this.encoder.encodeInto(value, dest);
            this.index += written;
            return;
        }
        const bytes = this.encoder.encode(value);
        this.writeBytes(bytes);
    }
    writeStringIndexed(value: string, bytesLength: 1 | 2 | 3 | 4 | 5 | 6): void {
        if(value.length < this.STRING_LENGTH_THRESHOLD) {
            this.ensureCapacity(value.length*3 + bytesLength);
            const dest = new Uint8Array(this.buffer, this.index + bytesLength);
            const {written} = this.encoder.encodeInto(value, dest);
            this.writeUint(written, bytesLength);
            this.index += written;
            return;
        }
        const bytes = this.encoder.encode(value);
        this.writeUint(bytes.length,bytesLength)
        this.writeBytes(bytes);
    }
    writeFromTypedArray(value: TypeArray) {
        const bytes = new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
        this.writeBytes(bytes);
    }
    // #endregion Writers

    
    schemaReader<T>(schema: SchemaType<T>): T {
        return schema.read.call(this);
    }

    schemaWriter<T>(schema: SchemaType<T>, value: T): void {
        schema.write.call(this, value);
    }

}


export interface SchemaType<T = unknown> {
   [Schema.FunctionSymb]: true;
   [Schema.ByteLength]?: number;
   read(): T;
   write(value: T): void;
}

export type ExtractSchema<T> = T extends SchemaType<infer U> ? U : never;

export class Schema {
    static readonly FunctionSymb = Symbol("function");
    static readonly ByteLength = Symbol("byteLength");

    static readonly uint8: SchemaType<number> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 1,
        read(this: Serializer) {
            return this.readUint8();
        },
        write(this: Serializer, value: number) {
            this.writeUint8(value)
        }
    }
    static readonly uint16: SchemaType<number> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 2,
        read(this: Serializer) { return this.readUint16(); },
        write(this: Serializer, value: number) { this.writeUint16(value); }
    }
    static readonly uint24: SchemaType<number> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 3,
        read(this: Serializer) { return this.readUint24(); },
        write(this: Serializer, value: number) { this.writeUint24(value); }
    }
    static readonly uint32: SchemaType<number> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 4,
        read(this: Serializer) { return this.readUint32(); },
        write(this: Serializer, value: number) { this.writeUint32(value); }
    }
    static readonly uint40: SchemaType<number> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 5,
        read(this: Serializer) { return this.readUint(5); },
        write(this: Serializer, value: number) { this.writeUint(value, 5); }
    }
    static readonly uint48: SchemaType<number> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 6,
        read(this: Serializer) { return this.readUint(6); },
        write(this: Serializer, value: number) { this.writeUint(value, 6); }
    }
    static readonly uint64: SchemaType<bigint> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 8,
        read(this: Serializer) { return this.readUint64(); },
        write(this: Serializer, value: bigint) { this.writeUint64(value); }
    }
    static readonly float64: SchemaType<number> = {
        [Schema.FunctionSymb]: true, [Schema.ByteLength]: 8,
        read(this: Serializer) { return this.readFloat64(); },
        write(this: Serializer, value: number) { this.writeFloat64(value); }
    }

    static float64Array(mapByteLength: 1 | 2 | 3 | 4 | 5 | 6): SchemaType<Float64Array> {
        return {
            [Schema.FunctionSymb]: true,
            read(this: Serializer) {
                const len = this.readUint(mapByteLength);
                const arr = new Float64Array(len);
                for (let i = 0; i < len; i++) {
                    arr[i] = this.readFloat64();
                }
                return arr;
            },
            write(this: Serializer, value: Float64Array) {
                this.writeUint(value.length, mapByteLength);
                for (let i = 0; i < value.length; i++) {
                    this.writeFloat64(value[i]);
                }
            }
        }
    }
    
    static string(mapByteLength: 1 | 2 | 3 | 4 | 5 | 6): SchemaType<string> {
        return {
            [Schema.FunctionSymb]: true,
            read(this: Serializer) {return this.readStringIndexed(mapByteLength)},
            write(this: Serializer, value: string) {this.writeStringIndexed(value, mapByteLength)}
        }
    }
    
    static array<const T>(mapByteLength: 1 | 2 | 3 | 4 | 5 | 6, object: SchemaType<T>): SchemaType<T[]> {
        return {
            [Schema.FunctionSymb]: true,
            read(this: Serializer) {
                const len = this.readUint(mapByteLength);
                const out: any[] = new Array();
                for (let i = 0; i < len; i++) {
                    out.push(object.read.call(this));
                }
                return out;
            },
            write(this: Serializer, value: any[]) {
                this.writeUint(value.length, mapByteLength);
                for (let i = 0; i < value.length; i++) {
                    object.write.call(this, value[i]);
                }
            }
        }
    }
    static object<const O extends Record<string, SchemaType<unknown>>>(object: O): SchemaType<{[k in keyof O]: O[k] extends SchemaType<infer T> ? T : never}> {
        return {
            [Schema.FunctionSymb]: true,
            read(this: Serializer) {
                let values: {[key: string]: unknown} = {};
                for (const key in object) {
                    if(!object.hasOwnProperty(key)) continue;
                    const value = object[key as keyof object];
                    values[key] = value.read.call(this);
                }
                return values as { [k in keyof O]: O[k] extends SchemaType<infer T> ? T : never; };
            },
            write(this: Serializer, obj) {
                for(const key in object) {
                    if(!object.hasOwnProperty(key)) continue;   
                    object[key as string].write.call(this, obj[key]);
                }
            }
        }
    }
}