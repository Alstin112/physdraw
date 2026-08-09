import Peer, { DataConnection } from "peerjs";
import { notifyOnSet } from "../Observables";
import { Schema, SchemaType, Serializer } from "./serializers";
import { AppMenu } from "../App";
import { autosave } from "./options";
import { RemotePaperFile } from "../PaperFile";

export interface PacketDefinition<T> {
    id: string;
    schema: SchemaType<T>;
}
export type packetHandler<T> = (data: T, conn: DataConnection) => void;
export class PacketRegistry {
    private static schemas = new Map<string, SchemaType<any>>();
    private static handlers = new Map<string, Set<packetHandler<any>>>();

    static register<T>(packet: PacketDefinition<T>) {
        this.schemas.set(packet.id, packet.schema);
    }

    static on<T>(packet: PacketDefinition<T>, handler: packetHandler<T>): () => void {
        if (!this.handlers.has(packet.id)) {
            this.handlers.set(packet.id, new Set());
        }

        const set = this.handlers.get(packet.id)!;
        set.add(handler);

        return () => set.delete(handler);
    }

    static serialize<T>(packet: PacketDefinition<T>, data: T): ArrayBuffer {
        const serializer = new Serializer();

        serializer.writeStringIndexed(packet.id, 1);
        serializer.schemaWriter(packet.schema, data);

        return serializer.getBuffer();
    }

    static handleIncomingBuffer(buffer: ArrayBuffer, conn: DataConnection) {
        const serial = new Serializer(buffer);

        const packetId = serial.readStringIndexed(1);
        const schema = this.schemas.get(packetId);

        if (!schema) {
            console.error(`Unknown packet ID: ${packetId}`);
            return;
        }

        const data = serial.schemaReader(schema);

        const packetHandlers = this.handlers.get(packetId);
        if (packetHandlers) {
            packetHandlers.forEach((handler) => handler(data, conn));
        }
    }
}

export class Network {

    @notifyOnSet
    @autosave
    accessor username: string = "User " + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    private peer: Peer | null = null;
    public server: DataConnection | null = null;
    public connections: Map<string, DataConnection> = new Map();


    isOnline() {
        return this.peer !== null;
    }
    isHost() {
        return !this.server;
    }

    private peerConfig = {
        secure: false,
        config: {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        },
    };

    connectToServer(serverId: string) {
        const { promise, resolve, reject } = Promise.withResolvers<string>();
        this.peer = new Peer(this.peerConfig);
        this.peer.on("open", () => {
            const conn = this.peer!.connect(serverId, { reliable: true });
            this.server = conn;

            conn.on("open", () => {
                this.serverSendPacket(Packets.JoinRequest, {
                    nick: this.username,
                    avatarBlob: ""
                });
                console.log("Connected to server with ID: " + serverId);
                resolve(serverId);
                AppMenu.loadPaperProgress = 0;
                AppMenu.LoadingScreenText = "Waiting for server to accept the connection...";
            });

            conn.on("data", (data) => {
                if (data instanceof ArrayBuffer) {
                    PacketRegistry.handleIncomingBuffer(data, conn);
                }
            });

            conn.on("close", () => {
                console.log("Client connection closed");
            });

            conn.on("error", (err) => {
                console.error("lient connection error: ", err);
                reject(err);
            });
        });

        this.peer.on("error", (err) => {
            console.error("Peer error: ", err);
            reject(err);
        });

        return promise;
    }

    openServerConnection(): Promise<string> {
        console.log("Opening server connection...");
        const { promise, resolve, reject } = Promise.withResolvers<string>();

        this.peer = new Peer(this.peerConfig);

        this.peer.on("open", (id) => {
            resolve(id);
        });

        this.peer.on("connection", (conn) => {
            console.log("Client connecting with ID: " + conn.peer);

            conn.on("open", () => {
                console.log("Client connection opened with ID: " + conn.peer);
                conn.send("Hello from server!");
            });

            conn.on("close", () => {
                AppMenu.canvasController.users = AppMenu.canvasController.users.filter(user => user.id !== conn.peer);
            });

            conn.on("error", (err) => {
                console.error("Server connection error: ", err);
            });

            conn.on("data", (data) => {
                if (data instanceof ArrayBuffer) {
                    PacketRegistry.handleIncomingBuffer(data, conn);
                }
            });

            this.connections.set(conn.peer, conn);
        });

        this.peer.on("error", (err) => {
            console.error("Server peer error: ", err);
            reject(err);
        });


        return promise;
    }

    serverSendPacket<T>(packet: PacketDefinition<T>, data: T) {
        if (!this.server) return;
        const buffer = PacketRegistry.serialize(packet, data);
        this.server.send(buffer);
    }

    clientSendPacket<T>(packet: PacketDefinition<T>, data: T, conn: DataConnection) {
        const buffer = PacketRegistry.serialize(packet, data);
        conn.send(buffer);
    }
    broadcastPacket<T>(packet: PacketDefinition<T>, data: T, ...exclude: DataConnection[]) {
        const buffer = PacketRegistry.serialize(packet, data);
        for (const conn of this.connections.values()) {
            if (!exclude.includes(conn)) {
                conn.send(buffer);
            }
        }
    }
    broadcastOrSendToServer<T>(packet: PacketDefinition<T>, data: T) {
        console.log("Broadcasting or sending packet:", packet.id, "with data:", data);
        if (this.isHost()) {
            this.broadcastPacket(packet, data);
        } else {
            this.serverSendPacket(packet, data);
        }
    }
}

export const Packets = {
    JoinRequest: {
        id: "join-req",
        schema: Schema.object({
            nick: Schema.string(1),
            avatarBlob: Schema.string(2),
        })
    },
    JoinDecline: {
        id: "join-decline",
        schema: Schema.object({})
    },
    SendPaper: {
        id: "send-paper",
        schema: Schema.object({
            userId: Schema.uint8,
            lines: Schema.array(4, Schema.object({
                points: Schema.array(4, Schema.float64),
                stroke: Schema.uint32,
                strokeWidth: Schema.uint8,
                lineId: Schema.uint32,
                owner: Schema.uint8,
            }))
        })
    },
    AddLine: {
        id: "add-line",
        schema: Schema.array(1, Schema.object({
            points: Schema.array(4, Schema.float64),
            stroke: Schema.uint32,
            strokeWidth: Schema.uint8,
            lineId: Schema.uint32,
            owner: Schema.uint8,
        }))
    },
    removeLine: {
        id: "remove-line",
        schema: Schema.array(1, Schema.object({
            lineId: Schema.uint32,
            owner: Schema.uint8,
        }))
    }
} as const satisfies Record<string, PacketDefinition<any>>;

Object.values(Packets).forEach(packet => PacketRegistry.register(packet as PacketDefinition<unknown>));


PacketRegistry.on(Packets.JoinRequest, (data, conn) => {
    AppMenu.canvasController.newJoinRequestPacket(data, conn)
});

PacketRegistry.on(Packets.SendPaper, (data) => {
    const isHost = !AppMenu.network.server;
    if (isHost) return;
    AppMenu.canvasController.importFromPacketData(data);
    AppMenu.paper = new RemotePaperFile("remote-paper");
    AppMenu.LoadingScreenText = "";
});

PacketRegistry.on(Packets.AddLine, (data, conn) => {
    AppMenu.canvasController.addLineFromPacketData(data);
    if (AppMenu.network.isHost()) {
        AppMenu.network.broadcastPacket(Packets.AddLine, data, conn);
    }
});

PacketRegistry.on(Packets.removeLine, (data, conn) => {
    console.log("Received removeLine packet from", conn.peer, "with data:", data);
    AppMenu.canvasController.eraseLinesFromPacketData(data);
    if (AppMenu.network.isHost()) {
        AppMenu.network.broadcastPacket(Packets.removeLine, data, conn);
    }
});