import "./menu.scss";

interface CopyInputProps {
    value: string;
    label?: string;
    error?: string | null;
}

export function CopyInput({ value, label, error }: CopyInputProps) {

    return (
        <div className={error ? "copy-input-container error" : "copy-input-container"} >
            {label && <label>{label}</label>}
            <input
                type="text"
                value={value}
                readOnly={true}
                onClick={(e) => {
                    navigator.clipboard.writeText(e.currentTarget.value);
                }}
            />
        </div>
    );
}