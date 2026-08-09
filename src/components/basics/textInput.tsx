import { useState } from "react";
import "./menu.scss";

interface TextInputProps {
    onChange?: (value: string) => void;
    onSend?: (value: string) => void;
    checkErrors?: (value: string) => string | null;
    value: string;
    placeholder?: string;
    label?: string;
}

export function TextInput({ onChange, onSend, checkErrors: filter, value, placeholder, label }: TextInputProps) {
    const [error, setError] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState<string>(value);
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if(inputValue === event.target.value) return;
        setInputValue(event.target.value);
        if(filter) {
            setError(filter(inputValue));
        }
        if(!error) {
            onChange?.(inputValue);
        }
    };

    return (
        <div className={error ? "text-input-container error" : "text-input-container"} >
            {label && <label>{label}</label>}
            <input
                type="text"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={(e) => e.key === "enter" && !error && onSend?.(inputValue)}
                onBlur={() => !error && onSend?.(inputValue)}
                placeholder={placeholder}
            />
        </div>
    );
}