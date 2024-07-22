// FilePreviewModal.js
import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import './FilePreviewModal.css';

const FilePreviewModal = ({ fileData, onClose }) => {
  const [sheets, setSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (fileData) {
      const workbook = XLSX.read(new Uint8Array(fileData), { type: 'array' });
      const parsedSheets = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        return {
          name: sheetName,
          data: XLSX.utils.sheet_to_json(sheet, { header: 1 }),
        };
      });
      setSheets(parsedSheets);
    }
  }, [fileData]);

  const handleSheetChange = (index) => {
    setActiveSheetIndex(index);
    setSearchQuery('');
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value.toLowerCase());
  };

  const activeSheet = sheets[activeSheetIndex];
  const filteredRows = activeSheet
    ? activeSheet.data.filter((row) =>
        row.some((cell) => cell.toString().toLowerCase().includes(searchQuery))
      )
    : [];

  const renderTable = () => {
    if (!activeSheet || !activeSheet.data.length) return null;

    const headers = activeSheet.data[0];
    const rows = filteredRows;

    return (
      <table className="preview-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn">&times;</button>
        <div className="excel-viewer">
          <div className="nav">
            {sheets.map((sheet, index) => (
              <button
                key={index}
                className={index === activeSheetIndex ? 'active' : ''}
                onClick={() => handleSheetChange(index)}
              >
                {sheet.name}
              </button>
            ))}
          </div>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
          <div className="sheet-container">
            {renderTable()}
          </div>
          <div className="download-btn-container">
            <a href={URL.createObjectURL(new Blob([fileData]))} download="file.xlsx" className="download-btn">Download Original File</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
