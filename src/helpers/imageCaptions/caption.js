const filenamePlaceholder = "%";
const filenameExtensionPlaceholder = "%.%";
function safeDecodeUri(value) {
    try {
        return decodeURIComponent(value);
    } catch  {
        return value;
    }
}
function stripQueryAndHash(value) {
    return value.split(/[?#]/, 1)[0] ?? value;
}
function filenameFromSrc(src, includeExtension) {
    const clean = safeDecodeUri(stripQueryAndHash(src)).replace(/\\/g, "/");
    const filename = clean.split("/").filter(Boolean).at(-1) ?? clean;
    if (includeExtension) return filename;
    const dot = filename.lastIndexOf(".");
    return dot > 0 ? filename.slice(0, dot) : filename;
}
function applyCaptionRegex(caption, pattern) {
    if (!pattern) return caption;
    try {
        const match = caption.match(new RegExp(pattern));
        return match?.[1] ?? "";
    } catch  {
        return caption;
    }
}
function detectAlignment(value) {
    const matches = [
        ...value.matchAll(/(?:^|\|)(left|center|right)(?=\||$)/g)
    ];
    const last = matches.at(-1)?.[1];
    return last;
}
function extractTrailingSize(alt, currentWidth, currentHeight) {
    const hasUsefulWidth = currentWidth && currentWidth !== "auto";
    const hasUsefulHeight = currentHeight && currentHeight !== "auto";
    if (hasUsefulWidth || hasUsefulHeight) {
        return {
            alt,
            width: currentWidth,
            height: currentHeight
        };
    }
    const match = alt.match(/^(.*?)(?:\|\s*(\d+)(?:x(\d+))?)\s*$/);
    if (!match) {
        return {
            alt,
            width: currentWidth,
            height: currentHeight
        };
    }
    return {
        alt: match[1] ?? "",
        width: match[2],
        height: match[3]
    };
}
function parseImageCaption(rawAlt, src, currentWidth, currentHeight, options) {
    const sized = extractTrailingSize(rawAlt.trim(), currentWidth, currentHeight);
    const imageAlt = sized.alt.trim();
    const alignment = detectAlignment(imageAlt);
    let caption = applyCaptionRegex(imageAlt, options.captionRegex);
    if (options.enableFilenamePlaceholders) {
        if (caption === filenamePlaceholder) {
            caption = filenameFromSrc(src, false);
        } else if (caption === filenameExtensionPlaceholder) {
            caption = filenameFromSrc(src, true);
        } else if (caption === `\\${filenamePlaceholder}`) {
            caption = filenamePlaceholder;
        }
    }
    return {
        caption,
        alignment,
        width: sized.width,
        height: sized.height,
        imageAlt
    };
}
function escapeMarkdownLabel(value) {
    return value.replace(/([\\\[\]])/g, "\\$1");
}
function escapeMarkdownDestination(value) {
    return value.replace(/([<>])/g, "\\$1");
}
function captionWikilinksToMarkdown(value) {
    return value.replace(/<<(.*?)>>/g, (_match, inner)=>{
        const pipe = inner.indexOf("|");
        const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
        const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();
        if (!target) return _match;
        return `[${escapeMarkdownLabel(label || target)}](<${escapeMarkdownDestination(target)}>)`;
    });
}
module.exports = {
    parseImageCaption,
    captionWikilinksToMarkdown
};
