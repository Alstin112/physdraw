import { ExtractSchema, Schema, Serializer } from "./lib/serializers";


export class PaperFile {
    id: string;
    size: number = -1;
    error: string | null = null;

    title: string = "";
    description: string = "";
    lastModified: number = -1;
    image: string = "";
    tags: string[] = [];

    static schemaMetadata = Schema.object({
        title: Schema.string(1),
        description: Schema.string(1),
        lastModified: Schema.float64,
        tags: Schema.array(1,Schema.string(1)),
        image: Schema.string(3),
    });

    static VERSION = 0;

    constructor(id: string) {
        this.id = id;
    }

    setIcon(image: string) {
        this.image = image;
        return this;
    }

    setSize(size: number) {
        this.size = size;
        return this;
    }
    importMetadata(buffer: ArrayBuffer): boolean {
        const serial = new Serializer(buffer);
        if(serial.buffer.byteLength < 1) {
            throw new Error(`Invalid file size: ${serial.buffer.byteLength}`);
        }
        const version = serial.readUint8();
        switch (version) {
            case 0: {

                const output = serial.schemaReader(PaperFile.schemaMetadata);
                this.title = output.title;
                this.description = output.description;
                this.lastModified = output.lastModified;
                this.tags = output.tags;
                this.image = output.image;


                return true;
            }
            default:
                throw new Error(`Update required to read this file. Current version: ${PaperFile.VERSION}, file version: ${version}`);
                return false;
        }
    }
    exportMetadata(): Uint8Array {
        const schema = {
            title: this.title,
            description: this.description,
            lastModified: this.lastModified,
            tags: this.tags,
            image: this.image,
        } satisfies ExtractSchema<typeof PaperFile.schemaMetadata>;
        
        const serial = new Serializer();
        serial.writeUint8(PaperFile.VERSION);
        serial.schemaWriter(PaperFile.schemaMetadata, schema);
        return serial.getFullUintArray();
    }
}

export class FullPaperFile extends PaperFile {
    isRemote: boolean = false;
    lines: ExtractSchema<typeof FullPaperFile.DataSchema>["lines"] = [];

    static DataSchema = Schema.object({
        lines: Schema.array(4, Schema.object({
            points: Schema.array(4, Schema.float64),
            stroke: Schema.uint32,
            strokeWidth: Schema.uint8,
        })),
    });
    
    static PacketSendPaperSchema = Schema.object({
        lines: Schema.array(4, Schema.object({
            points: Schema.array(4, Schema.float64),
            stroke: Schema.uint32,
            strokeWidth: Schema.uint8,
        })),
    });

    constructor(id: string) {
        super(id);
    }
    
    writeToUint8Array(): Uint8Array<ArrayBuffer> {
        const serial = new Serializer();
        serial.writeUint8(PaperFile.VERSION);
        serial.schemaWriter(FullPaperFile.DataSchema, {
            lines: this.lines
        });
        return serial.getFullUintArray();
    }

    async deflateUint8Array(): Promise<ReadableStream<Uint8Array<ArrayBuffer>>> {
        const cs = new CompressionStream('deflate');
        
        const writer = cs.writable.getWriter();
        writer.write(this.writeToUint8Array());
        writer.close();

        return cs.readable as ReadableStream<Uint8Array<ArrayBuffer>>;
    }

    readFromBuffer(buffer: ArrayBuffer) {
        const serial = new Serializer(buffer);
        const version = serial.readUint8();
        if (version !== PaperFile.VERSION) {
            throw new Error(`Update required to read this file. Current version: ${PaperFile.VERSION}, file version: ${version}`);
        }
        this.lines = serial.schemaReader(FullPaperFile.DataSchema).lines;
        return serial.index;
    }
    async readFromStream(stream: ReadableStream<Uint8Array<ArrayBuffer>>) {
        return new Promise<void>((resolve, reject) => {
            const reader = stream.getReader();
            const chunks: Uint8Array[] = [];
            let totalLength = 0;

            const readChunk = () => {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        const combined = new Uint8Array(totalLength);
                        let offset = 0;
                        for (const chunk of chunks) {
                            combined.set(chunk, offset);
                            offset += chunk.length;
                        }
                        this.readFromBuffer(combined.buffer);
                        resolve();
                    } else {
                        chunks.push(value);
                        totalLength += value.length;
                        readChunk();
                    }
                }).catch(reject);
            };
            readChunk();
        });
    }


}

export class RemotePaperFile extends FullPaperFile {
    isRemote: boolean = true;
}