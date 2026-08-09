import { useState } from "react";
import { useBufferedObservable } from "../../Observables";
import { AppMenu } from "../../App";

export function JoinTab() {
    const [username, setUsername] = useBufferedObservable(AppMenu.network, "username");
    const [ip, setIp] = useState("");
    
    return <div id="join-paper-menu">
        <div id="settings">
            <span>Username:</span>
            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                    setUsername(e.target.value);
                }}
                onBlur={(e) => {
                    setUsername(e.target.value.trim());
                }}
            />
        </div>
        {username ? (<>
            <div id="join-paper-link">
                <h1>Join by Link</h1>
                <input type="text" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="Paste the link here..." />
                <button disabled={ip === ""} onClick={()=>AppMenu.network.connectToServer(ip)}>Join</button>
            </div>
            <div id="join-paper-multicast">
                <h1>Join by Lan</h1>
            </div>
        </>) : (<div id="join-paper-login">
            <h1>Set your username to join a paper</h1>
        </div>)}
    </div>
}