import React from 'react';
import { segmentChinese, rubyUnits } from '../utils/segment';

function HanziText(props) {
    const { text, pinyin, as: Tag = 'span', className, ...rest } = props;
    const units = pinyin ? rubyUnits(text, pinyin) : null;

    if (units) {
        return (
            <Tag className={`${className || ''} has-ruby`.trim()} {...rest}>
                {units.map((unit, index) => (
                    <React.Fragment key={`${unit.text}-${index}`}>
                        {index > 0 && <wbr />}
                        <span className="cjk-word">
                            <ruby>
                                {unit.text}
                                <rt>{unit.pinyin || ' '}</rt>
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
