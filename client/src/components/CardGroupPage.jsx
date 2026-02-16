import React, { useState, useEffect } from 'react';
import axios from 'axios';

function CardGroupPage() {
    const [groups, setGroups] = useState([]);
    const [allSentences, setAllSentences] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchGroups();
        fetchSentences();
    }, []);

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('http://localhost:5001/api/card-groups', { withCredentials: true });
            setGroups(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSentences = async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/sentences', { withCredentials: true });
            setAllSentences(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async () => {
        if (!newName) return;
        try {
            await axios.post('http://localhost:5001/api/card-groups', {
                name: newName,
                sentenceIds: Array.from(selectedIds)
            }, { withCredentials: true });
            
            setIsCreating(false);
            setNewName("");
            setSelectedIds(new Set());
            fetchGroups();
        } catch(err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if(!window.confirm("Delete this group?")) return;
        try {
            await axios.delete(`http://localhost:5001/api/card-groups/${id}`, { withCredentials: true });
            fetchGroups();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    return (
        <div className="main-content">
            <div className="word-page-container">
                <div className="word-page-header">
                    <h2>My Card Groups</h2>
                    <button className="add-btn" onClick={() => setIsCreating(true)}>+ New Group</button>
                </div>

                {isCreating && (
                    <div className="sentence-form" style={{marginBottom: '30px'}}>
                        <h3>Create New Group</h3>
                        <input 
                            className="sentence-input" 
                            placeholder="Group Name" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                        />
                        
                        <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #444', margin:'10px 0', padding:'10px', background: '#222'}}>
                            {allSentences.map(s => (
                                <div key={s.id} style={{display:'flex', gap:'10px', marginBottom:'5px', alignItems: 'center'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(s.id)} 
                                        onChange={() => toggleSelection(s.id)}
                                        style={{cursor: 'pointer'}}
                                    />
                                    <span style={{color: '#ddd'}}>{s.chineseText} <span style={{color: '#888', fontSize: '0.9em'}}>({s.englishTranslation})</span></span>
                                </div>
                            ))}
                        </div>

                        <div className="preview-actions">
                            <button className="btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
                            <button className="btn-success" onClick={handleCreate}>Save Group</button>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <p>Loading groups...</p>
                ) : (
                    <div className="word-grid">
                        {groups.map(g => (
                            <div key={g.id} className="word-card">
                                <div className="word-card-header">
                                    <h3 className="word-hanzi">{g.name}</h3>
                                </div>
                                <div className="word-card-body">
                                    <p className="word-pinyin" style={{marginBottom: '10px'}}>{g.sentences.length} sentences</p>
                                    <button 
                                        className="btn-delete-all" 
                                        style={{width: '100%', marginTop: '10px', padding: '8px'}} 
                                        onClick={() => handleDelete(g.id)}
                                    >
                                        Delete Group
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {!isLoading && groups.length === 0 && (
                     <div className="no-sentences">
                        <p>No card groups created yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CardGroupPage;