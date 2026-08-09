import { useState } from "react";
import "./SelectScreen.scss";
import { JoinTab } from "./menu/JoinTab";
import { PaperTab } from "./menu/PaperTabs";


export function SelectScreen() {
    const [activeTab, setActiveTab] = useState("Saved Papers");

    return (
        <div id="select-menu">
            <div id="main-content">
                <div id="tab-selection">
                    <button className={activeTab === "Saved Papers" ? "active" : ""} onClick={() => setActiveTab("Saved Papers")}>Saved Papers</button>
                    <button className={activeTab === "Join Paper" ? "active" : ""} onClick={() => setActiveTab("Join Paper")}>Join Paper</button>
                </div>
                <div id="content">{
                    activeTab === "Saved Papers" ? (<PaperTab />) :
                        activeTab === "Join Paper" ? (<JoinTab />) :
                            null
                }</div>
            </div>
        </div >
    );
}