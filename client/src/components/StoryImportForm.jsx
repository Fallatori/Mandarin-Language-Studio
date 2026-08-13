import React, { useState } from 'react';
import { useStoryImport } from '../hooks/useStoryImport';

const StatBox = ({ label, value, type }) => (
    <div className={`stat-box stat-${type}`}>
        <span className="stat-number">{value}</span>
        <span className="stat-label">{label}</span>
    </div>
);

const ExampleCodeBlock = () => (
    <div className="bulk-code-container">
        <div className="bulk-code-label">Example format (JSON):</div>
        <pre className="bulk-code-pre">
{`{
  "title": "我的经理",
  "chineseText": "我的经理是一个中国人，他很喜欢开会。",
  "sentences": [
    {
      "chineseText": "我的经理是一个中国人，他很喜欢开会。",
      "pinyin": "wǒ de jīng lǐ shì yī gè zhōng guó rén",
      "englishTranslation": "My manager is Chinese, and he loves meetings.",
      "words": [
        { "chineseWord": "经理", "pinyin": "jīng lǐ", "englishTranslation": "manager" }
      ]
    }
  ]
}`}
        </pre>
        <p className="bulk-hint">
            Only <code>sentences[].chineseText</code> is required. Leave out
            <code> words</code> and the server segments that sentence for you.
        </p>
    </div>
);

function StoryImportForm({ onImportComplete, onCancel }) {
    const { status, payload, previewData, importResult, error, processFile, importData } = useStoryImport();
    const [showExample, setShowExample] = useState(false);

    const handleFinish = () => {
        if (importResult?.story) onImportComplete(importResult.story);
        else onCancel();
    };

    if (status === 'success' && importResult) {
        return (
            <div className="sentence-form">
                <h3>Import Summary</h3>
                <div className="bulk-result-container">
                    <div className="bulk-result-stats">
                        <StatBox label="Sentences" value={importResult.added.length} type="success" />
                        <StatBox label="Words Added" value={importResult.wordsAdded} type="success" />
                        <StatBox label="Skipped" value={importResult.skipped.length} type="skipped" />
                        {importResult.errors.length > 0 &&
                            <StatBox label="Errors" value={importResult.errors.length} type="error" />
                        }
                    </div>
                    {importResult.skipped.length > 0 && (
                        <div className="bulk-skipped-list">
                            <h4>Skipped Items:</h4>
                            <div className="skipped-items-container">
                                {importResult.skipped.map((t, i) => <span key={i} className="skipped-tag">{t}</span>)}
                            </div>
                        </div>
                    )}
                    {importResult.errors.length > 0 && (
                        <div className="bulk-error-list">
                            <h4>Errors Details:</h4>
                            {importResult.errors.map((err, idx) => (
                                <div key={idx} className="bulk-error-item">
                                    <strong>{err.text}:</strong> {err.error}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="preview-actions centered">
                        <button onClick={handleFinish} className="btn-success">Done</button>
                    </div>
                </div>
            </div>
        );
    }

    const totalDuplicates = previewData.filter(d => d.isDuplicate || d.isBatchDuplicate).length;
    const newCount = previewData.length - totalDuplicates;

    return (
        <div className="sentence-form">
            <h3>Import Story from JSON</h3>
            <p className="bulk-hint">
                Upload a story whose sentences and translations are already prepared.
                Nothing is auto-split, so your own sentence boundaries are kept.
            </p>

            <div className="bulk-file-input-wrapper">
                <input
                    type="file"
                    accept=".json"
                    onChange={(e) => processFile(e.target.files[0])}
                    className="bulk-file-input"
                />
                <button type="button" className="btn-toggle-example" onClick={() => setShowExample(!showExample)}>
                    {showExample ? 'Hide Example' : 'Show Example'}
                </button>
            </div>

            {showExample && <ExampleCodeBlock />}

            {error && <p className="error-message">{error}</p>}

            {payload && (
                <div className="story-import-header">
                    <span className="story-import-title hanzi-font">{payload.title || 'Untitled story'}</span>
                    <span className="story-import-count">{previewData.length} sentences</span>
                </div>
            )}

            {previewData.length > 0 && (
                <div className="preview-list">
                    {totalDuplicates > 0 && (
                        <div className="bulk-skipped-preview">
                            <h4>Skipped Items ({totalDuplicates}):</h4>
                            <div className="skipped-items-container">
                                {previewData.filter(d => d.isDuplicate || d.isBatchDuplicate).map((item, idx) => (
                                    <span key={idx} className={`skipped-tag ${item.isBatchDuplicate ? 'tag-file' : 'tag-db'}`}>
                                        {item.chineseText}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    <h4 className="bulk-preview-title">
                        Review ({previewData.length} items)
                        {totalDuplicates > 0 && <span className="bulk-skipped-count">({totalDuplicates} skipped)</span>}
                    </h4>
                    <div className="bulk-list-container">
                        {previewData.map((item, idx) => (
                            <div key={idx} className={`bulk-list-item ${(item.isDuplicate || item.isBatchDuplicate) ? 'duplicate' : ''}`}>
                                <div className="bulk-item-content">
                                    <div className="bulk-item-chinese-group">
                                        <span className="bulk-item-pinyin">{item.pinyin}</span>
                                        <div>
                                            <span className="bulk-item-chinese hanzi-font">{item.chineseText}</span>
                                            {item.isDuplicate && <span className="bulk-badge-duplicate bulk-badge-db">Existing</span>}
                                            {item.isBatchDuplicate && <span className="bulk-badge-duplicate bulk-badge-file">Duplicate</span>}
                                            {!item.words && <span className="bulk-badge-duplicate bulk-badge-file">Auto-segment</span>}
                                        </div>
                                    </div>
                                    <div className="bulk-item-english">{item.englishTranslation}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="preview-actions">
                <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
                <button
                    type="button"
                    onClick={importData}
                    disabled={status === 'uploading' || status === 'checking' || previewData.length === 0}
                    className="btn-success"
                >
                    {status === 'uploading' || status === 'checking' ? 'Processing...' : `Import ${newCount} Sentences`}
                </button>
            </div>
        </div>
    );
}

export default StoryImportForm;
