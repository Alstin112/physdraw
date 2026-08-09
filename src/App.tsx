import "./App.scss";
import { SelectScreen } from "./components/SelectScreen";
import { notifyOnSet, useObservable } from "./Observables";
import { FileManager } from "./lib/services/storage";
import { FullPaperFile, PaperFile } from "./PaperFile";
import { CanvasController, DrawScreen } from "./components/DrawScreen";
import { InputInteractionManager } from "./ScreenInteractionManager";
import { EventManager } from "./lib/events";
import { Options } from "./lib/options";
import { Network } from "./lib/connection";
import { VanillaPlugin } from "./VanillaPlugin";
import { PluginRegistry } from "./lib/plugins";
import { UrlJoinScreen } from "./components/UrlJoinScreen";


export class LocationManager {
	path: string;
	queryParams: { [key: string]: string };

	constructor(path: string, queryParams: { [key: string]: string }) {
		this.path = path;
		this.queryParams = queryParams;
	}

	static ParseLocation(): LocationManager | null {
		const hash = window.location.hash.replace("#", '');
		if (!hash) return null;

		const [path, queryString] = hash.split("?");
		const queryParams = new URLSearchParams(queryString);
		const params: { [key: string]: string } = {};
		for (const [key, value] of queryParams.entries()) {
			params[key] = value;
		}
		return new LocationManager(path, params);
	}

	getRemoteId(): string | null {
		if (this.path === "remote" && this.queryParams["id"]) {
			return this.queryParams["id"];
		}
		return null;
	}

	getPaperId(): string | null {
		if (this.path === "paper" && this.queryParams["id"]) {
			return this.queryParams["id"];
		}
		return null;
	}

	static loadPaper(paper: PaperFile) {
		const newHash = `#paper?id=${paper.id}`;
		window.location.hash = newHash;
	}

	static goMenu() {
		window.location.hash = "";
	}
}
export class AppMenu {

	@notifyOnSet
	static accessor paper: FullPaperFile | null = null;
	@notifyOnSet
	static accessor LoadingScreenText: string = "Loading App";
	@notifyOnSet
	static accessor urlJoinId: string | null = null;
	
	static pluginRegistry: PluginRegistry;
	static network: Network;

	static eventManager = new EventManager();
	static canvasController = new CanvasController();
	static loadPaperProgress: number = -1;

	

	static async init() {
		if (!navigator.storage) {
			console.error("Storage API is not available");
			this.LoadingScreenText = "Storage API is not available. Please use a better browser 🥀.";
			return;
		}
		await Options.load();

		window.addEventListener("keydown", InputInteractionManager.handleKeyDown);
		window.addEventListener("keyup", InputInteractionManager.handleKeyUp);
		window.addEventListener("keypress", InputInteractionManager.handleKeyPress);

		AppMenu.loadPlugins();
		AppMenu.eventManager.emit("main:afterInit");
		AppMenu.defineHashReloading();

		AppMenu.network = new Network();

		this.LoadingScreenText = "Loading paper from URL if present...";
		const location = LocationManager.ParseLocation();
		const remoteId = location?.getRemoteId();
		const paperId = location?.getPaperId();
		if (remoteId) {
			this.urlJoinId = remoteId;
		} else if (paperId) {
			AppMenu.loadNowWithId(paperId);
		}
		this.LoadingScreenText = "";
	}

	static loadPlugins() {
		this.pluginRegistry = new PluginRegistry(this.canvasController);
		const vanillaPlugin = new VanillaPlugin();
		vanillaPlugin.init(this.pluginRegistry);
	}

	static defineHashReloading() {
		window.addEventListener("hashchange", () => {
			this.urlJoinId = null;
			console.log("Hash changed, reloading paper if needed");
			const location = LocationManager.ParseLocation();
			const remoteId = location?.getRemoteId();
			const paperId = LocationManager.ParseLocation()?.getPaperId();
			if (remoteId) {
				this.urlJoinId = remoteId;
			} if (!paperId) {
				this.loadPaperProgress = -1;
				this.paper = null;
			} else {
				this.loadPaperProgress = 0;
				this.loadNowWithId(paperId)
					.then(() => {
						this.loadPaperProgress = 1;
					})
					.catch((error) => {
						console.error("Error loading paper:", error);
					});
			}
		});
	}

	static async loadNowWithId(paperId: string) {
		this.loadPaperProgress = 0;
		const paper = await FileManager.loadFullPaperById(paperId);
		if (!paper) {
			this.loadPaperProgress = -1;
			return;
		}
		this.loadPaperProgress = 1;
		this.LoadingScreenText = "";
		LocationManager.loadPaper(paper);
		this.canvasController.loadFromFullPaper(paper);
		this.paper = paper;

	}

	static newPaper() {
		const date = new Date();
		this.paper = new FullPaperFile("untitled-" + date.getTime());
		this.paper.title = "Untitled " + date.getTime();
		this.paper.lastModified = date.getTime();
		FileManager.savePaper(this.paper);
		LocationManager.loadPaper(this.paper);
		this.canvasController.clear();
		this.paper = this.paper;
	}

	static saveActivePaper() {
		if (!this.paper) return Promise.resolve();
		this.canvasController.updateFullPaper(this.paper);
		return FileManager.savePaper(this.paper);
	}

	static SavingActivePaperTimer: number | null = null;
	static requestSaveActivePaper() {
		if (this.SavingActivePaperTimer) {
			clearTimeout(this.SavingActivePaperTimer);
		}

		this.SavingActivePaperTimer = setTimeout(() => {
			this.saveActivePaper();
		}, 1_000);
	}

	static cleanUp() {
		console.log("Cleaning up AppMenu...");
	}
}

AppMenu.init().catch((error) => {
	console.error("Error initializing app:", error);
});

function App() {

	const paper = useObservable(AppMenu, "paper")
	const loadingScreenText = useObservable(AppMenu, "LoadingScreenText")
	const urlJoinId = useObservable(AppMenu, "urlJoinId")

	const state: "loading" | "menu" | "paper" | "remote" =
		urlJoinId ? "remote" :
			loadingScreenText ? "loading" :
				(paper == null) ? "menu" :
					"paper";

	// console.log("App state:", state, "Paper:", paper, "Loading progress:", AppMenu.loadPaperProgress);
	return (
		<div id="app-container">
			{
				state === "loading" ? <div>{loadingScreenText}</div> :
					state === "remote" ? <UrlJoinScreen /> :
						state === "menu" ? <SelectScreen /> :
							state === "paper" ? <DrawScreen /> :
								<div>Unknown state</div>
			}
		</div>
	);
}

export default App;
