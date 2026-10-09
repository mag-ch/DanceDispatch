export function renderDescriptionWithLineBreaks(text: string) {
    const normalized = text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
    const lines = normalized.split('\n');

    return lines.map((line, index) => (
        <span key={index}>
            {line}
            {index < lines.length - 1 && <br />}
        </span>
    ));
}