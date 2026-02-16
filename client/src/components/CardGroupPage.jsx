import React, { useState, useEffect } from 'react';
import axios from 'axios';

function CardGroupPage() {
    const [groups, setGroups] = useState([]);
    const [allSentences, setAllSentences] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());

    useEffect(() => {
        fetchGroups();
        fetchSentences();
    }, []);

    const fetchGroups = async () => {
        const res = await axios.get('http://localhost:5001/api/card-groups', { withCredentials: true });
        setGroups(res.data);
    };

    const fetchSentences = async () => {
        const res = await axios.get('http://localhost:5001/api/sentences', { withCredentials: true });
        setAllSentences(res.data);
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
        await axios.delete(`http://localhost:5001/api/card-groups/${id}`, { withCredentials: true });
        fetchGroups();
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    return (
        <div className="main-content">
            <div className="word-page-header">
                <h2>Card Groups</h2>
                <button className="add-btn" onClick={() => setIsCreating(true)}>+ New Group</button>
            </div>

            {isCreating && (
                <div className="sentence-form">
                    <h3>Create New Group</h3>
                    <input 
                        className="sentence-input" 
                        placeholder="Group Name" 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)}
                    />
                    
                    <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #444', margin:'10px 0', padding:'10px'}}>
                        {allSentences.map(s => (
                            <div key={s.id} style={{display:'flex', gap:'10px', marginBottom:'5px'}}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.has(s.id)} 
                                    onChange={() => toggleSelection(s.id)}
                                />
                                <span>{s.chineseText} ({s.englishTranslation})</span>
                            </div>
                        ))}
                    </div>

                    <div className="preview-actions">
                        <button className="btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
                        <button className="btn-success" onClick={handleCreate}>Save Group</button>
                    </div>
                </div>
            )}

            <div className="word-grid">
                {groups.map(g => (
                    <div key={g.id} className="word-card">
                         <h3>{g.name}</h3>
                         <p>{g.sentences.length} sentences</p>
                         <button className="btn-delete-all" style={{padding:'5px 10px'}} onClick={() => handleDelete(g.id)}>Delete</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CardGroupPage;