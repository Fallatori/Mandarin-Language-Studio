import React, { useState } from 'react';
import { useBulkUpload } from '../hooks/useBulkUpload';

const StatBox = ({ label, value, type }) => (
    <div className={`stat-box stat-${type}`}>
        <span className="stat-number">{value}</span>
        <span className="stat-label">{label}</span>
    </div>
);

const PreviewItem = ({ item }) => (
    <div className={`bulk-list-item ${(item.isDuplicate || item.isBatchDuplicate) ? 'duplicate' : ''}`}>
        <div className="bulk-item-content">
            <div className="bulk-item-chinese-group">
                <span className="bulk-item-pinyin">{item.pinyin}</span>
                <div>
                    <span className="bulk-item-chinese">{item.chineseText}</span>
                    {item.isDuplicate && <span className="bulk-badge-duplicate bulk-badge-db">Existing</span>}
                    {item.isBatchDuplicate && <span className="bulk-badge-duplicate bulk-badge-file">Duplicate</span>}
                </div>
            </div>
            <div className="bulk-item-english">{item.englishTranslation}</div>
        </div>
    </div>
);

const ExampleCodeBlock = () => (
    <div className="bulk-code-container">
        <div className="bulk-code-label">Example format (JSON):</div>
        <pre className="bulk-code-pre">
{`[
  {
    "chineseText": "你好",
    "pinyin": "nǐ hǎo",
    "englishTranslation": "Hello",
    "words": [ { "chineseWord": "你好", "pinyin": "nǐ hǎo", "englishTranslation": "Hello" } ]
  }
]`}
        </pre>
    </div>
);

function BulkUploadForm({ onUploadComplete, onCancel }) {
    const { status, previewData, uploadResult, error, processFile, uploadData } = useBulkUpload();
    const [showExample, setShowExample] = useState(false);

    const handleFinish = () => {
        if (uploadResult?.added?.length > 0) onUploadComplete(uploadResult.added);
        else onCancel();
    };

    if (status === 'success' && uploadResult) {
        return (
            <div className="sentence-form">
                <h3>Upload Summary</h3>
                <div className="bulk-result-container">
                    <div className="bulk-result-stats">
                        <StatBox label="Added" value={uploadResult.added.length} type="success" />
                        <StatBox label="Skipped" value={uploadResult.skipped.length} type="skipped" />
                        {uploadResult.errors.length > 0 && 
                            <StatBox label="Errors" value={uploadResult.errors.length} type="error" />
                        }
                    </div>
                    {uploadResult.skipped.length > 0 && (
                         <div className="bulk-skipped-list">
                            <h4>Skipped Items:</h4>
                            <div className="skipped-items-container">
                                {uploadResult.skipped.map((t, i) => <span key={i} className="skipped-tag">{t}</span>)}
                            </div>
                        </div>
                    )}
                     {uploadResult.errors.length > 0 && (
                        <div className="bulk-error-list">
                            <h4>Errors Details:</h4>
                            {uploadResult.errors.map((err, idx) => (
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
            <h3>Bulk Upload Sentences</h3>
            <p className="bulk-hint">
                Upload a JSON file to add multiple sentences at once
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
            
            {previewData.length > 0 && (
                <div className="preview-list">
                    {totalDuplicates > 0 && (
                         <div className="bulk-skipped-preview">
                            <h4>
                                Skipped Items ({totalDuplicates}):
                            </h4>
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
                            <PreviewItem key={idx} item={item} />
                        ))}
                    </div>
                </div>
            )}
            <div className="preview-actions">
                <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
                <button 
                    type="button" 
                    onClick={uploadData} 
                    disabled={status === 'uploading' || status === 'checking' || previewData.length === 0}
                    className="btn-success"
                >
                    {status === 'uploading' || status === 'checking' ? 'Processing...' : `Upload ${newCount} New Items`}
                </button>
            </div>
        </div>
    );
}




export default BulkUploadForm;
