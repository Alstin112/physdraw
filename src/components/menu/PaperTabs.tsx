import { useEffect, useRef, useState } from "react";
import { FileManager } from "../../lib/services/storage";
import { PaperFile } from "../../PaperFile";
import { AppMenu, LocationManager } from "../../App";
import { PaperIcon } from "../PaperIcon";
import { TagFilter } from "../TagFilter";

export function PaperTab() {
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedPapers, setSelectedPapers] = useState<Set<PaperFile> | null>();
    const [paperSearch, setPaperSearch] = useState<string>("");
    const [papers, setPapers] = useState<PaperFile[]>([]);

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        FileManager.loadPapers()
            .then((loadedpapers) => {
                setPapers(loadedpapers);
            })
            .catch((error) => {
                console.error("Error loading papers:", error);
            });
    }, []);

    const tagList = papers.flatMap((paper) => paper.tags);
    const visiblePapers = papers
        .filter((paper) => selectedTags.every((tag) => paper.tags.includes(tag)) && paper.title.toLowerCase().includes(paperSearch.toLowerCase()));
    const unusedTag = new Set(tagList.filter((tag) => !visiblePapers.some((paper) => paper.tags.includes(tag))));
    const shouldClick = useRef(true);

    let paperHoldTimeout: number | null = null;

    function paperClick(paper: PaperFile, e: React.MouseEvent<HTMLDivElement>) {
        if (selectedPapers != null) {
            paperHold(paper);
            return;
        }
        console.log(e);
        if (!paper.error && e.button == 0) LocationManager.loadPaper(paper);
    }

    function paperHold(paper: PaperFile) {
        if (selectedPapers == null) {
            console.log("Paper hold detected:", paper);
            setSelectedPapers(new Set([paper]));
            return;
        }
        const isSelected = selectedPapers.has(paper);
        if (!isSelected) {
            setSelectedPapers(new Set([...selectedPapers, paper]));
        } else {
            const newSelected = new Set(selectedPapers);
            newSelected.delete(paper);
            if (newSelected.size === 0) {
                setSelectedPapers(null);
            } else {
                setSelectedPapers(newSelected);
            }
        }
    }

    function mouseDownHandler(paper: PaperFile, _e: React.MouseEvent<HTMLDivElement>) {
        paperHoldTimeout = setTimeout(() => {
            paperHold(paper);
            shouldClick.current = false;
        }, 500);
    }

    function mouseUpHandler(paper: PaperFile, e: React.MouseEvent<HTMLDivElement>) {
        if (paperHoldTimeout) {
            clearTimeout(paperHoldTimeout);
            paperHoldTimeout = null;
        }
        if (shouldClick.current) {
            paperClick(paper, e);
        } else {
            shouldClick.current = true;
        }
    }

    return <div className="flex fullheight" id="paper-tab">
        <div id="tag-list">
            {tagList.map((tag) => (
                <TagFilter
                    key={tag}
                    name={tag}
                    checked={selectedTags.includes(tag)}
                    toggleCheck={() => {
                        if (selectedTags.includes(tag)) {
                            setSelectedTags(selectedTags.filter((t) => t !== tag));
                        } else {
                            setSelectedTags([...selectedTags, tag]);
                        }
                    }}
                    disabled={unusedTag.has(tag)}
                />
            ))}
        </div>
        <div id="papers">
            <div id="papers-tools">
                <input type="text" placeholder="Search papers..." onChange={(e) => setPaperSearch(e.target.value)} />
                {selectedPapers && <>
                    <button onClick={() => {
                        for (const paper of selectedPapers) {
                            FileManager.deletePaperById(paper.id);
                        }
                        setSelectedPapers(null);
                        setPapers(papers.filter((paper) => !selectedPapers.has(paper)));
                    }}>delete</button>
                    {/* <button>clone</button> */}
                </>}
            </div>
            <div id="papers-list">
                <div
                    onClick={() => { AppMenu.newPaper() }}
                    id="paper-create">
                </div>
                {visiblePapers.map((paper) => (
                    <PaperIcon
                        key={paper.id}
                        title={paper.error ?? paper.title ?? "Untitled"}
                        description={paper.error ? null : paper.description}
                        errored={!!paper.error}
                        selected={selectedPapers?.has(paper) ?? false}
                        onDown={(e) => mouseDownHandler(paper, e)}
                        onUp={(e) => mouseUpHandler(paper, e)}
                    />
                ))}
            </div>
        </div>
    </div>
}