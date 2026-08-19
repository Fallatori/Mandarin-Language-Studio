import React from 'react';
import { segmentChinese, segmentGroups } from '../utils/segment';
import { charTilesFromText } from '../utils/learnIme';

function rubyParts(text, pinyin) {
    const pieces = charTilesFromText(text, pinyin);
    if (!pieces.some((piece) => piece.pinyin)) return null;
    return segmentGroups(text, pieces.length).map((group) => {
        const wordPieces = pieces.slice(group.start, group.end);
        return {
            text: wordPieces.map((piece) => piece.text).join(''),
            pinyin: wordPieces.map((piece) => piece.pinyin).filter(Boolean).join(' '),
        };
    });
}

function HanziText(props) {
    const { text, pinyin, as: Tag = 'span', className, ...rest } = props;
    const parts = pinyin ? rubyParts(text, pinyin) : null;

    if (parts) {
        return (
            <Tag className={`${className || ''} has-ruby`.trim()} {...rest}>
                {parts.map((part, index) => (
                    <React.Fragment key={`${part.text}-${index}`}>
                        {index > 0 && <wbr />}
                        <span className="cjk-word">
                            <ruby>
                                {part.text}
                                <rt>{part.pinyin || ' '}</rt>
                            </ruby>
                        </span>
                    </React.Fragment>
                ))}
            </Tag>
        );
    }

    return (
        <Tag className={className} {...rest}>
            {segmentChinese(text).map((part, index) => (
                <span key={`${part}-${index}`} className="cjk-word">{part}</span>
            ))}
        </Tag>
    );
}

export default HanziText;
