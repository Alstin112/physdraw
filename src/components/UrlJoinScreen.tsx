import { useState } from "react";
import { AppMenu, LocationManager } from "../App";
import { useBufferedObservable } from "../Observables";

export function UrlJoinScreen() {
    const [username, setUsername] = useBufferedObservable(AppMenu.network, "username");
    const [error, setError] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    return <div id="url-join-screen">
        <h1>Enter your Nickname:</h1>
        <div id="url-join-screen-content">
            <input value={username} onChange={(e) => setUsername(e.target.value)}></input>
            <button disabled={username.length < 3} onClick={() => {
                setError(false);
                setMessage("Loading...");
                AppMenu.network.connectToServer(AppMenu.urlJoinId!).catch((err) => {
                    console.error("Error connecting to server:", err);
                    setError(true);
                    setMessage("Failed to connect to server. Please check the link and try again.");
                });
            }}>Join</button>
        </div>
        {message && <span id={`url-join-screen-error ${error ? 'error' : ''}`}>{message}</span>}
        <div id="url-leave-screen-header">
            <button onClick={() => LocationManager.goMenu()}>Leave</button>
        </div>
    </div>
}