import { useEffect, useRef, useState } from "react";
import "./CanvasOptionsMenu.scss";
import { AppMenu, LocationManager } from "../App";
import { TextInput } from "./basics/textInput";
import { TagInput } from "./basics/tagInput";
import { useBufferedObservable, useObservable } from "../Observables";
import { CopyInput } from "./basics/copyInput";
import {QRCodeSVG} from "qrcode.react";

interface CanvasOptionsMenuProps {
    open: boolean;
    closeModal: () => void;
}

function ShareCategory() {
    const [serverOpen, setServerOpen] = useState<boolean>(false);
    const [ServerId, setServerId] = useState<string>("<SERVER_ID>");
    const [username, setUsername] = useBufferedObservable(AppMenu.network, "username");
    const url = "https://alstin112.github.io/physdraw/#remote?id="+ServerId;

    const users = useObservable(AppMenu.canvasController, "users");
    const usersToAccept = users.reduce((a,u) => a + +!u.accepted ,0)

    return <div className="canvas-options-menu-section" id="canvas-options-menu-share-section">
        <h3>Share Options</h3>
        <div>
            <TextInput
                value={username}
                onSend={(txt) => setUsername(txt)}
                label="Username"
            />
            <button onClick={(btn) => {
                btn.currentTarget.disabled = true;
                AppMenu.network.openServerConnection()
                    .then((id) => {
                        setServerId(id);
                        setServerOpen(true);
                    })
                    .catch((err) => {
                        console.error("Error opening server connection:", err);
                        btn.currentTarget.disabled = false;
                    });
            }}>Open Server</button>
        </div>
        <div id="canvas-options-menu-share-section-server-info">
            <span>{serverOpen ? "Server is open" : "Waiting for server open"}</span>
            <div style={{ display: serverOpen ? "flex" : "none" }}>
                <div>
                    <CopyInput value={ServerId} label="Enter by ID" />
                    <CopyInput value={url} label="Enter by URL" />
                    <button onClick={() => AppMenu.canvasController.openMenu("users")}>View Players Menu
                        {usersToAccept > 0 && <span>{usersToAccept}</span>}
                    </button>
                </div>
                { serverOpen && <QRCodeSVG value={url} size={200}  />}
            </div>
        </div>
    </div>
}

export function CanvasOptionsMenu({ open, closeModal }: CanvasOptionsMenuProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open) {
            if (!dialog.open) {
                dialog.showModal();
            }
        } else {
            if (dialog.open) {
                dialog.close();
            }
        }
    }, [open]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        console.log("Backdrop click detected:", e);
        if (!dialogRef.current) return;

        const rect = dialogRef.current.getBoundingClientRect();

        const clickedOutside =
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom;

        if (clickedOutside) {
            closeModal();
        }
    };

    return (
        <dialog
            ref={dialogRef}
            onClose={closeModal}
            id="canvas-options-dialog"
            onClick={handleBackdropClick}
        >
            <div>
                <div id="canvas-options-menu-header">
                    <div>
                        <button onClick={() => {
                            if (AppMenu.SavingActivePaperTimer) clearTimeout(AppMenu.SavingActivePaperTimer)
                            AppMenu.saveActivePaper().then(() => {
                                LocationManager.goMenu();
                            }).catch((err) => {
                                console.error("Error saving paper:", err);
                            });
                        }}>Menu</button>
                        {/* <button onClick={() => {
                            AppMenu.canvasController.clear();
                            AppMenu.requestSaveActivePaper();
                        }}>Clear</button> */}
                    </div>
                    <div>
                        <button onClick={closeModal}>Close</button>
                    </div>
                </div>
                <div id="canvas-options-menu">
                    <div id="canvas-options-menu-lateral-bar">
                        <div id="canvas-options-menu-lateral-bar-titles">
                            <h2>Paper Options</h2>
                            <h2>Share</h2>
                        </div>
                    </div>
                    <div id="canvas-options-menu-content">
                        <div className="canvas-options-menu-section">
                            <h3>Paper Options</h3>
                            <p>Here you can configure the paper settings.</p>
                            <TextInput
                                value={AppMenu.paper!.title}
                                onSend={(txt) => AppMenu.paper!.title = txt}
                                checkErrors={(value) => new TextEncoder().encode(value).length > 255 ? "Title is too long" : null}
                                label="Title"
                            />
                            <TextInput
                                value={AppMenu.paper!.description}
                                onSend={(txt) => AppMenu.paper!.description = txt}
                                checkErrors={(value) => new TextEncoder().encode(value).length > 255 ? "Title is too long" : null}
                                label="Description"
                            />
                            <TagInput
                                value={AppMenu.paper!.tags}
                                onSend={(tags) => AppMenu.paper!.tags = tags}
                                label="Tags"
                            />
                        </div>
                        <ShareCategory />
                    </div>
                </div>
            </div>
        </dialog>
    );
}