import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import FilePreviewModal from './FilePreviewModal';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { currentUser, logout, addClient, getClients, updateClient, deleteClient, uploadClientFile, updateResultSettings, getResultSettings } = useAuth();
  const [clients, setClients] = useState([]);
  const [newClient, setNewClient] = useState({ email: '', password: '' });
  const [editClient, setEditClient] = useState(null);
  const [files, setFiles] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [filePreview, setFilePreview] = useState({});
  const [resultSettings, setResultSettings] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [customFileName, setCustomFileName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const clientsData = await getClients();
        setClients(clientsData);
        const resultSettingsData = {};
        for (const client of clientsData) {
          const settings = await getResultSettings(client.id);
          resultSettingsData[client.id] = settings;
        }
        setResultSettings(resultSettingsData);
      } catch (error) {
        console.error("Error fetching clients:", error);
      }
    };

    fetchClients();
  }, [getClients, getResultSettings]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    try {
      await addClient(newClient.email, newClient.password);
      const clientsData = await getClients();
      setClients(clientsData);
      setNewClient({ email: '', password: '' });
    } catch (error) {
      console.error("Error adding client:", error);
    }
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    try {
      await updateClient(editClient.id, editClient.email, editClient.newPassword);
      const clientsData = await getClients();
      setClients(clientsData);
      setEditClient(null);
    } catch (error) {
      console.error("Error updating client:", error);
    }
  };

  const handleDeleteClient = async (id) => {
    try {
      await deleteClient(id);
      const clientsData = await getClients();
      setClients(clientsData);
    } catch (error) {
      console.error("Error deleting client:", error);
    }
  };

  const handleFileChange = (e, clientId) => {
    const file = e.target.files[0];
    setFiles({ ...files, [clientId]: file });

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview({ ...filePreview, [clientId]: e.target.result });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleUpload = async (clientId) => {
    if (!files[clientId]) {
      setUploadStatus({ ...uploadStatus, [clientId]: 'Please select a file.' });
      return;
    }

    if (!customFileName.trim()) {
      setUploadStatus({ ...uploadStatus, [clientId]: 'Please enter a custom file name.' });
      return;
    }

    try {
      setUploadStatus({ ...uploadStatus, [clientId]: 'Uploading...' });
      const fileUrl = await uploadClientFile(clientId, files[clientId]);
      setUploadStatus({ ...uploadStatus, [clientId]: 'File uploaded successfully!' });

      const clientDocRef = doc(db, 'users', clientId);
      const clientDoc = await getDoc(clientDocRef);
      const existingFiles = clientDoc.data().files || [];

      await updateDoc(clientDocRef, {
        files: arrayUnion({
          name: customFileName,
          url: fileUrl,
          originalName: files[clientId].name
        })
      });

      setClients(prevClients =>
        prevClients.map(client =>
          client.id === clientId ? { 
            ...client, 
            files: [
              ...(client.files || []),
              { name: customFileName, url: fileUrl, originalName: files[clientId].name }
            ]
          } : client
        )
      );

      setFiles({ ...files, [clientId]: null });
      setFilePreview({ ...filePreview, [clientId]: null });
      setCustomFileName('');
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus({ ...uploadStatus, [clientId]: `File upload failed: ${error.message}` });
    }
  };

  const handleDeleteFile = async (clientId, fileToDelete) => {
    try {
      const clientDocRef = doc(db, 'users', clientId);
      
      const fileRef = ref(storage, fileToDelete.url);
      await deleteObject(fileRef);

      await updateDoc(clientDocRef, {
        files: arrayRemove(fileToDelete)
      });

      setClients(prevClients =>
        prevClients.map(client =>
          client.id === clientId ? {
            ...client,
            files: (client.files || []).filter(file => file.url !== fileToDelete.url)
          } : client
        )
      );

      setUploadStatus({ ...uploadStatus, [clientId]: 'File deleted successfully!' });
    } catch (error) {
      console.error('Error deleting file:', error);
      setUploadStatus({ ...uploadStatus, [clientId]: `File deletion failed: ${error.message}` });
    }
  };

  const handlePreview = (clientId) => {
    setPreviewData(filePreview[clientId]);
  };

  const handleResultSettingsChange = (clientId, resultKey, field, value) => {
    setResultSettings(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [resultKey]: {
          ...(prev[clientId]?.[resultKey] || {}),
          [field]: value
        }
      }
    }));
  };

  const addNewResult = (clientId) => {
    const currentResults = resultSettings[clientId] || {};
    const nextResultLetter = String.fromCharCode('a'.charCodeAt(0) + Object.keys(currentResults).length);
    const newResultKey = nextResultLetter;

    setResultSettings(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [newResultKey]: { hiddenColumns: '', sheetName: '' }
      }
    }));
  };

  const saveResultSettings = async (clientId) => {
    try {
      await updateResultSettings(clientId, resultSettings[clientId]);
      setUploadStatus({ ...uploadStatus, [clientId]: 'Result settings saved successfully!' });
    } catch (error) {
      console.error('Error saving result settings:', error);
      setUploadStatus({ ...uploadStatus, [clientId]: `Failed to save result settings: ${error.message}` });
    }
  };

  const renderFilePreview = (clientId) => {
    const file = files[clientId];
    if (!file) return null;

    return (
      <div>
        <button onClick={() => handlePreview(clientId)} className="preview-btn">Preview File</button>
        <button onClick={() => handleUpload(clientId)} className="upload-btn">Confirm Upload</button>
      </div>
    );
  };

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>
      <main className="dashboard-content">
        <section className="client-form-section">
          <h2>{editClient ? 'Edit Client' : 'Add New Client'}</h2>
          <form onSubmit={editClient ? handleEditClient : handleAddClient} className="admin-form">
            <input
              type="email"
              value={editClient ? editClient.email : newClient.email}
              onChange={(e) => editClient ? setEditClient({ ...editClient, email: e.target.value }) : setNewClient({ ...newClient, email: e.target.value })}
              placeholder={`Email`}
              required
            />
            {!editClient && (
              <input
                type="password"
                value={newClient.password}
                onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                placeholder={`Password`}
                required
              />
            )}
            {editClient && (
              <input
                type="password"
                value={editClient.newPassword || ''}
                onChange={(e) => setEditClient({ ...editClient, newPassword: e.target.value })}
                placeholder={`New Password (leave blank to keep current)`}
              />
            )}
            <button type="submit" className="submit-btn">{editClient ? 'Update Client' : 'Add Client'}</button>
            {editClient && <button type="button" onClick={() => setEditClient(null)} className="cancel-btn">Cancel Edit</button>}
          </form>
        </section>
        <section className="client-list-section">
          <h2>Client List</h2>
          <ul className="client-list">
            {clients.map((client) => (
              <li key={client.id} className="client-item">
                <div className="client-info">
                  <span>{client.email}</span>
                  <div className="client-actions">
                    <button onClick={() => setEditClient(client)} className="edit-btn">Edit</button>
                    <button onClick={() => handleDeleteClient(client.id)} className="delete-btn">Delete</button>
                  </div>
                </div>
                <div className="client-file-upload">
                  <h3>Uploaded Files:</h3>
                  <ul>
                    {client.files && client.files.map((file, index) => (
                      <li key={index}>
                        {file.name} (Original: {file.originalName})
                        <button onClick={() => handleDeleteFile(client.id, file)}>Delete</button>
                      </li>
                    ))}
                  </ul>
                  <input type="file" id={`file-upload-${client.id}`} onChange={(e) => handleFileChange(e, client.id)} />
                  <label htmlFor={`file-upload-${client.id}`} className="file-upload-label">Choose File</label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="Enter custom file name"
                  />
                  {renderFilePreview(client.id)}
                  {uploadStatus[client.id] && <p>{uploadStatus[client.id]}</p>}
                  <div className="result-settings-box">
                    <h3>Result Settings:</h3>
                    {Object.entries(resultSettings[client.id] || {}).map(([resultKey, settings]) => (
                      <div key={resultKey} className="result-setting">
                        <p>Result {resultKey.toUpperCase()}: Hidden Columns: {settings.hiddenColumns}, Sheet Name: {settings.sheetName}</p>
                        <input
                          type="text"
                          placeholder={`Result ${resultKey.toUpperCase()} - Hidden Columns`}
                          value={settings.hiddenColumns || ''}
                          onChange={(e) => handleResultSettingsChange(client.id, resultKey, 'hiddenColumns', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder={`Result ${resultKey.toUpperCase()} - Sheet Name`}
                          value={settings.sheetName || ''}
                          onChange={(e) => handleResultSettingsChange(client.id, resultKey, 'sheetName', e.target.value)}
                        />
                      </div>
                    ))}
                    <button onClick={() => addNewResult(client.id)} className="add-result-btn">Add New Result</button>
                    <button onClick={() => saveResultSettings(client.id)} className="save-results-btn">Save Result Settings</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
      {previewData && <FilePreviewModal fileData={previewData} onClose={() => setPreviewData(null)} />}
    </div>
  );
};

export default AdminDashboard;