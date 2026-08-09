import { useState } from "react";

interface TagInputProps {
    onChange?: (value: string[]) => void;
    onSend?: (value: string[]) => void;
    checkErrors?: (value: string[]) => string | null;
    value: string[];
    placeholder?: string;
    label?: string;
}

export function TagInput({ onChange, onSend, checkErrors, value, placeholder, label }: TagInputProps) {
    const [tags, setTags] = useState<string[]>(value);
    const [inputValue, setInputValue] = useState("");
    const error = checkErrors?.(tags) ?? null;

    const addTag = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        const nextTags = [...tags, trimmed];
        setTags(nextTags);
        setInputValue("");
        onChange?.(nextTags);
        onSend?.(nextTags);
    };

    const removeTag = (tagToRemove: string) => {
        const nextTags = tags.filter((tag) => tag !== tagToRemove);
        setTags(nextTags);
        onChange?.(nextTags);
        onSend?.(nextTags);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addTag();
        }
    };
    const handleBlur = () => {
        if (inputValue.trim() !== "") {
            addTag();
        }
    };

    return <div className="tag-input-component">
        {label ? <span className="tag-input-label">{label}</span> : null}
        <div className="tag-input-component-container">
            {error ? <span className="tag-input-error">{error}</span> : null}
            {tags.map((t) => (
                <button className="tag" key={t} onClick={() => removeTag(t)}>
                    <span className="tag-label">{t}</span>
                    <span className="tag-remove">
                        ×
                    </span>
                </button>
            ))}
            <label className="tag-add">
                <span className="tag-add-icon">+</span>
                <input
                    type="text"
                    className="tag-input"
                    placeholder={placeholder ?? "Adicionar tag"}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                />
            </label>
        </div>
    </div>
}