import { BaseDirectory, mkdir, readDir, open, exists, remove } from "@tauri-apps/plugin-fs";
import { FullPaperFile, PaperFile } from "../../PaperFile";

export class FileManager {
    static MAX_METADATA_SIZE = 5 * 1024 * 1024


    static firstTime = true;
    public static async loadPapers(): Promise<PaperFile[]> {
        await mkdir("papers", { baseDir: BaseDirectory.AppData, recursive: true });
        this.firstTime = false;
        const files = (await readDir("papers", { baseDir: BaseDirectory.AppData }))
            .filter((file) => file.isFile && file.name.endsWith(".infcanvas"));

        return (await Promise.all(files.map((file) => FileManager.loadPaperById(file.name.replace(".infcanvas", "")))))
            .filter((file) => file !== null);
    }

    public static async loadFullPaperById(paperId: string): Promise<FullPaperFile | null> {
        const path = `papers/${paperId}.infcanvas`;
        let file: Awaited<ReturnType<typeof open>> | null = null;
        const paperFile = new FullPaperFile(paperId);

        try {
            file = await open(path, { baseDir: BaseDirectory.AppData });

            const stats = await file.stat();
            paperFile.setSize(stats.size);

            const metadataIndex = new Uint8Array(4);
            await file.read(metadataIndex);
            const metadataLength = new DataView(
                metadataIndex.buffer,
                metadataIndex.byteOffset,
                metadataIndex.byteLength
            ).getUint32(0, true);

            if (metadataLength > FileManager.MAX_METADATA_SIZE) {
                throw new Error(`Metadata size ${metadataLength} exceeds maximum allowed size of ${FileManager.MAX_METADATA_SIZE}`);
            }
            if (metadataLength > stats.size - 4) {
                throw new Error(`Metadata size ${metadataLength} exceeds available space in file`);
            }

            const metadata = new Uint8Array(metadataLength);
            await file.read(metadata);

            const buffer = metadata.buffer.slice(metadata.byteOffset, metadata.byteOffset + metadata.byteLength);
            if (!paperFile.importMetadata(buffer)) {
                throw new Error(`Failed to load paper metadata for ${paperId}`);
            }

            // Load Data
            const activeFile = file;
            file = null;
            const tauriStream = new ReadableStream<Uint8Array<ArrayBuffer>>({
                async pull(controller) {
                    try {
                        const chunk = new Uint8Array(64 * 1024);
                        const bytesRead = await activeFile.read(chunk);

                        if (bytesRead === null || bytesRead === 0) {
                            await activeFile.close();
                            controller.close();
                        } else {
                            controller.enqueue(chunk.subarray(0, bytesRead));
                        }
                    } catch (error) {
                        await activeFile.close();
                        controller.error(error);
                    }
                },
                async cancel() {
                    await activeFile.close();
                },
            });
            await paperFile.readFromStream(tauriStream.pipeThrough(new DecompressionStream('deflate')) as ReadableStream<Uint8Array<ArrayBuffer>>);
            return paperFile;
        } catch (error) {
            console.error("Error reading file:", error);
            return paperFile;
        } finally {
            if (file) {
                await file.close();
                console.log("file closed");
            }
        }
    }

    private static async loadPaperById(paperId: string): Promise<PaperFile | null> {
        const path = `papers/${paperId}.infcanvas`;
        const file = await open(path, { baseDir: BaseDirectory.AppData });
        const paperFile: PaperFile = new PaperFile(paperId);
        try {
            const stats = await file.stat();
            paperFile.setSize(stats.size);

            const metadataIndex = new Uint8Array(4);
            await file.read(metadataIndex);
            const metadataLength = new DataView(metadataIndex.buffer).getUint32(0, true);
            if (metadataLength > FileManager.MAX_METADATA_SIZE) {
                throw new Error(`Metadata size ${metadataLength} exceeds maximum allowed size of ${FileManager.MAX_METADATA_SIZE}`);
            }
            if (metadataLength > stats.size - 4) {
                throw new Error(`Metadata size ${metadataLength} exceeds available space in file`);
            }
            const metadata = new Uint8Array(metadataLength);
            await file.read(metadata);
            if (!paperFile.importMetadata(metadata.buffer)) {
                throw new Error(`Failed to load paper metadata for ${paperId}`);
            }
        } catch (error) {
            if (error instanceof Error) {
                paperFile.error = error.message;
            } else {
                paperFile.error = String(error);
            }
            console.error("Error reading file:", error);
            return null;
        } finally {
            await file.close();
            return paperFile;
        }
    }

    public static async savePaper(paper: PaperFile | FullPaperFile) {
        const metadata = paper.exportMetadata();
        const metadataLength = metadata.length;
        if (metadataLength > FileManager.MAX_METADATA_SIZE) {
            throw new Error(`Metadata size ${metadataLength} exceeds maximum allowed size of ${FileManager.MAX_METADATA_SIZE}`);
        }
        const metadataSize = new Uint8Array(4);
        new DataView(metadataSize.buffer).setUint32(0, metadataLength, true);
        let totalSize = 4 + metadataLength;
        const fullMetadata = new Uint8Array(totalSize);
        fullMetadata.set(metadataSize, 0);
        fullMetadata.set(metadata, 4);

        const path = `papers/${paper.id}.infcanvas`;

        const file = await open(path, {
            write: true,
            create: true,
            truncate: true,
            baseDir: BaseDirectory.AppData,
        });

        try {
            await file.write(fullMetadata);
            if (paper instanceof FullPaperFile) {
                const deflateStream = await paper.deflateUint8Array();
                const tauriWritable = new WritableStream<Uint8Array>({
                    async write(chunk) {
                        await file.write(chunk);
                    }
                });
                await deflateStream.pipeTo(tauriWritable, { preventClose: true });
            }
        } catch (error) {
            console.error("Error writing file:", error);
        } finally {
            await file.close();
        }
    }

    public static async loadConfig(): Promise<string | null> {
        const path = `config.json`;
        let result = null;
        let file: Awaited<ReturnType<typeof open>> | null = null;
        try {
            if (await exists(path, { baseDir: BaseDirectory.AppData })) {
                // if file does not exist, return null
                file = await open(path, { baseDir: BaseDirectory.AppData });
                const stats = await file.stat();
                const buffer = new Uint8Array(stats.size);
                await file.read(buffer);
                result = new TextDecoder().decode(buffer);
            }
        } catch (error) {
            console.error("Error reading config file:", error);
            result = null;
        } finally {
            if (file) {
                await file.close();
            }
        }
        return result;
    }

    public static async saveConfig(config: string) {
        const path = `config.json`;
        let file : Awaited<ReturnType<typeof open>> | null = null;
        try {
            file = await open(path, {
                write: true,
                create: true,
                truncate: true,
                baseDir: BaseDirectory.AppData,
            });
            await file.write(new TextEncoder().encode(config));
        } finally {
            if(file) await file.close();
        }
    }

    public static async deletePaperById(paperId: string) {
        const path = `papers/${paperId}.infcanvas`;
        try {
            if (await exists(path, { baseDir: BaseDirectory.AppData })) {
                await remove(path, { baseDir: BaseDirectory.AppData });
            }
        } catch (error) {
            console.error("Error deleting paper file:", error);
        }
    }
}