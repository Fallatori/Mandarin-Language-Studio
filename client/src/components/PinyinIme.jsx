import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { normalizePinyin } from '../utils/pinyinSearch';

function consumeCount(raw, count) {
    let taken = 0;
    let i = 0;
    while (i < raw.length && taken < count) {
        if (normalizePinyin(raw[i])) taken += 1;
        i += 1;
    }
    return raw.slice(i);
}

function trailingLatin(value) {
    const match = String(value || '').match(/^(.*?)([a-zA-ZüÜvV:0-9']*)$/u);
    return {
        committed: match ? match[1] : value,
        buffer: match ? match[2] : '',
    };
}

function PinyinIme({
    value,
    onChange,
    multiline = false,
    placeholder,
    id,
    className,
    disabled,
    required,
    onCommit,
}) {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [active, setActive] = useState(0);
    const seqRef = useRef(0);
    const { buffer } = trailingLatin(value);

    useEffect(() => {
        if (disabled || !buffer) {
            setCandidates([]);
            setActive(0);
            return undefined;
        }
        const seq = seqRef.current + 1;
        seqRef.current = seq;
        const timer = setTimeout(async () => {
            try {
                const res = await axios.get(
                    `http://localhost:5001/api/ime?q=${encodeURIComponent(buffer)}`,
                    { withCredentials: true },
                );
                if (seqRef.current !== seq) return;
                setCandidates(res.data?.candidates || []);
                setActive(0);
            } catch (err) {
                if (err.response && err.response.status === 401) {
                    navigate('/login');
                }
            }
        }, 80);
        return () => clearTimeout(timer);
    }, [buffer, disabled, navigate]);

    const commit = (item) => {
        const parts = trailingLatin(value);
        const leftover = consumeCount(parts.buffer, item.consumed);
        const next = `${parts.committed}${item.text}${leftover}`;
        onChange(next);
        if (onCommit) onCommit(item);
        setActive(0);
    };

    const handleKeyDown = (event) => {
        if (disabled || !buffer) return;
        const selected = candidates.length
            ? Math.min(active, candidates.length - 1)
            : 0;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            if (!candidates.length) return;
            event.preventDefault();
            setActive((index) => (index + 1) % candidates.length);
            return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            if (!candidates.length) return;
            event.preventDefault();
            setActive((index) => (index - 1 + candidates.length) % candidates.length);
            return;
        }

        const digit = event.key >= '1' && event.key <= '9' ? Number(event.key) : 0;
        if (digit && candidates[digit - 1]) {
            event.preventDefault();
            commit(candidates[digit - 1]);
            return;
        }

        if (event.key === ' ' || event.key === 'Tab') {
            if (!candidates.length) return;
            event.preventDefault();
            commit(candidates[selected]);
        }
    };

    const Field = multiline ? 'textarea' : 'input';

    return (
        <div className={`compose-ime${multiline ? ' multiline' : ''}`}>
            <div className="compose-ime-cands" role="listbox" aria-label="Hanzi suggestions">
                {candidates.map((item, index) => (
                    <button
                        key={`${item.text}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        className={`compose-ime-cand${index === active ? ' current' : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => commit(item)}
                    >
                        <span className="compose-ime-num">{index + 1}</span>
                        <span className="hanzi-font">{item.text}</span>
                    </button>
                ))}
            </div>
            <Field
                id={id}
                className={className}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={handleKeyDown}
            />
        </div>
    );
}

export default PinyinIme;
