// import { PaperFile } from "../Others";

import { FullPaperFile, PaperFile } from "../../PaperFile";

export class FileManager {
    static MAX_METADATA_SIZE = 5 * 1024 * 1024;

    static firstTime = true;
    static async loadPapers() {
        const root = await navigator.storage.getDirectory();
        const dirHandle = await root.getDirectoryHandle("papers", { create: true });
        const files: PaperFile[] = [];
        for await (const entry of (dirHandle as any).values()) {
            if(entry.kind === "file" && entry.name.endsWith(".infcanvas")) {
                const paperId = entry.name.replace(".infcanvas", "");
                const paperFile = await FileManager.loadPaperById(paperId);
                if (paperFile) {
                    files.push(paperFile);
                }
            }
        }
        return files;
    }
    static async loadFullPaperById(paperId: string) {
        const root = await navigator.storage.getDirectory();
        const papersDir = await root.getDirectoryHandle("papers", { create: true });
        const fileHandle = await papersDir.getFileHandle(`${paperId}.infcanvas`, { create: true });
        const paperFile = new FullPaperFile(paperId);
        try {
            const file = await fileHandle.getFile();
            const size = file.size;
            if(size <= 4) {
                throw new Error(`File size ${size} is too small to contain metadata`);
            }
            paperFile.setSize(size);
             
            const metadataIndex = await file.slice(0, 4).arrayBuffer();
            const metadataLength = new DataView(metadataIndex).getUint32(0, true);
            if(metadataLength > FileManager.MAX_METADATA_SIZE) {
                throw new Error(`Metadata size ${metadataLength} exceeds maximum allowed size of ${FileManager.MAX_METADATA_SIZE}`);
            }
            if(metadataLength > size - 4) {
                throw new Error(`Metadata size ${metadataLength} exceeds available space in file`);
            }
            const metadata = await file.slice(4, 4 + metadataLength).arrayBuffer();
            if (!paperFile.importMetadata(metadata)) {
                throw new Error(`Failed to load paper metadata for ${paperId}`);
            }

            const tauriStream = file.slice(4 + metadataLength).stream();
            await paperFile.readFromStream(
                    tauriStream.pipeThrough(new DecompressionStream('deflate')) as ReadableStream<Uint8Array<ArrayBuffer>>
            )

            return paperFile;
        } catch (error) {
            if(error instanceof Error) {
                paperFile.error = error.message;
            } else {
                paperFile.error = String(error);
            }
            console.error("Error reading file:", error);
            return paperFile;
        }
    }
    static async loadPaperById(paperId: string) {
        const root = await navigator.storage.getDirectory();
        const papersDir = await root.getDirectoryHandle("papers", { create: true });
        const file = await papersDir.getFileHandle(`${paperId}.infcanvas`, { create: true });
        const paperFile: PaperFile = new PaperFile(paperId);
        try {
            const size = (await file.getFile()).size;
            if(size <= 4) {
                throw new Error(`File size ${size} is too small to contain metadata`);
            }
            paperFile.setSize(size);
            
            const metadataIndex = await (await file.getFile()).slice(0, 4).arrayBuffer();
            const metadataLength = new DataView(metadataIndex).getUint32(0, true);
            if(metadataLength > FileManager.MAX_METADATA_SIZE) {
                throw new Error(`Metadata size ${metadataLength} exceeds maximum allowed size of ${FileManager.MAX_METADATA_SIZE}`);
            }
            if(metadataLength > size - 4) {
                throw new Error(`Metadata size ${metadataLength} exceeds available space in file`);
            }
            const metadata = await (await file.getFile()).slice(4, 4 + metadataLength).arrayBuffer();
            if (!paperFile.importMetadata(metadata)) {
                throw new Error(`Failed to load paper metadata for ${paperId}`);
            }
            return paperFile;
        } catch (error) {
            if(error instanceof Error) {
                paperFile.error = error.message;
            } else {
                paperFile.error = String(error);
            }
            console.error("Error reading file:", error);
            return paperFile;
        }
    }
    static async savePaper(paper: PaperFile | FullPaperFile) {

        const metadata = paper.exportMetadata();
        const metadataLength = metadata.length;
        if (metadataLength > FileManager.MAX_METADATA_SIZE) {
            throw new Error(`Metadata size ${metadataLength} exceeds maximum allowed size of ${FileManager.MAX_METADATA_SIZE}`);
        }
        const metadataSize = new Uint8Array(4);
        new DataView(metadataSize.buffer).setUint32(0, metadataLength, true);
        let totalSize = 4 + metadataLength;
        const fullData = new Uint8Array(totalSize);
        fullData.set(metadataSize, 0);
        fullData.set(metadata, 4);

        const root = await navigator.storage.getDirectory();
        const papersDir = await root.getDirectoryHandle("papers", { create: true });
        const fileHandle = await papersDir.getFileHandle(`${paper.id}.infcanvas`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(fullData);
        
        if (paper instanceof FullPaperFile) {
            const deflateStream = await paper.deflateUint8Array();
            await deflateStream.pipeTo(writable, { preventClose: true });
        }

        await writable.close();
    }

    
    public static async loadConfig(): Promise<string | null> {
        const path = `config.json`;
        let result = null;
        console.log(navigator.storage)
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(path, { create: true });
        try {
            const file = await fileHandle.getFile();
            if(file.size > 0) {
                const buffer = await file.arrayBuffer();
                result = new TextDecoder().decode(buffer);
            }
        } catch (error) {
            console.error("Error reading config file:", error);
        }
        return result;
    }

    public static async saveConfig(config: string) {
        const path = `config.json`;
        const root = await navigator.storage.getDirectory();
        let writable: FileSystemWritableFileStream | null = null;
        try {
            const file = await root.getFileHandle(path, { create: true });
            writable = await file.createWritable({ keepExistingData: false });
            await writable.write(new TextEncoder().encode(config));
        } catch (error) {
            console.error("Error writing config file:", error);
        } finally {
            if (writable) {
                await writable.close();
            }
        }
    }

    public static async deletePaperById(paperId: string) {
        const root = await navigator.storage.getDirectory();
        try {
            const papersDir = await root.getDirectoryHandle("papers", { create: true });
            await papersDir.removeEntry(`${paperId}.infcanvas`);
        } catch (error) {
            console.error("Error deleting paper file:", error);
        }
    }
}