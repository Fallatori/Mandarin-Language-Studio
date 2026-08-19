import React from 'react';
import { segmentChinese } from '../utils/segment';

function HanziText(props) {
    const { text, as: Tag = 'span', className, ...rest } = props;
    return (
        <Tag className={className} {...rest}>
            {segmentChinese(text).map((part, index) => (
                <span key={`${part}-${index}`} className="cjk-word">{part}</span>
            ))}
        </Tag>
    );
}

export default HanziText;
