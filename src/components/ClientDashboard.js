import React, { useEffect, useState, useRef } from 'react';
import ExcelJS from 'exceljs';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const [workbook, setWorkbook] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser, logout } = useAuth();
  const [clientFiles, setClientFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageUrls, setImageUrls] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const tableRef = useRef(null);
  const [resultSettings, setResultSettings] = useState({});
  const [hiddenColumns, setHiddenColumns] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      setError("No user logged in");
      setLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
    
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.files && userData.files.length > 0) {
            setClientFiles(userData.files);
          } else {
            setError("No files uploaded for this client");
          }
          
          // Fetch result settings
          const settings = await getResultSettings(currentUser.uid);
          setResultSettings(settings);
        } else {
          setError("User document not found");
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError(`Error loading user data: ${err.message}`);
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [currentUser]);

  const getResultSettings = async (userId) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        return userDoc.data().resultSettings || {};
      }
      return {};
    } catch (error) {
      console.error("Error fetching result settings:", error);
      return {};
    }
  };

  const loadFile = async (fileUrl) => {
    try {
      setLoading(true);
      const proxyUrl = `/proxy${new URL(fileUrl).pathname}${new URL(fileUrl).search}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      setWorkbook(workbook);

      const sheetNames = workbook.worksheets.map(sheet => sheet.name);
      setSheets(sheetNames);
      setActiveSheetIndex(0);

      const images = [];
      workbook.eachSheet((sheet) => {
        sheet.getImages().forEach((image) => {
          const img = workbook.model.media.find((m) => m.index === image.imageId);
          images.push({ ...image, img, sheetName: sheet.name });
        });
      });

      const imageUrls = await Promise.all(
        images.map(async (image) => {
          const fileRef = ref(storage, `images/${currentUser.uid}/${image.img.name}`);
          await uploadBytes(fileRef, image.img.buffer);
          const url = await getDownloadURL(fileRef);
          return { ...image, url };
        })
      );

      setImageUrls(imageUrls);

      setLoading(false);
    } catch (err) {
      console.error("Error loading file:", err);
      setError(`Error loading file: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSheetChange = (index) => {
    setActiveSheetIndex(index);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    setHiddenColumns([]);
  };

  const downloadExcel = async () => {
    if (selectedFile) {
      try {
        const fileRef = ref(storage, selectedFile.url);
        const downloadURL = await getDownloadURL(fileRef);
        
        const link = document.createElement('a');
        link.href = downloadURL;
        link.download = selectedFile.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Error downloading file:", error);
      }
    } else {
      console.error("No file selected");
    }
  };

  const getCellValue = (cell) => {
    if (!cell) return '';
    try {
      if (cell.value === null || cell.value === undefined) return '';
      if (typeof cell.value === 'object' && cell.value.richText) {
        return cell.value.richText.map(rt => rt.text).join('');
      }
      if (cell.hyperlink) {
        return React.createElement('a', {
          href: cell.hyperlink,
          target: "_blank",
          rel: "noopener noreferrer"
        }, cell.text || cell.value.toString());
      }
      return cell.text || cell.value.toString() || '';
    } catch (error) {
      console.error('Error getting cell value:', error);
      return '';
    }
  };

  const renderSheetContent = () => {
    if (!workbook || activeSheetIndex < 0 || activeSheetIndex >= workbook.worksheets.length) return null;

    const worksheet = workbook.worksheets[activeSheetIndex];
    const rows = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (!hiddenColumns.includes(colNumber)) {
          const style = {
            width: `${worksheet.getColumn(colNumber).width}px`,
            height: `${row.height}px`,
          };
          if (cell.font) {
            if (cell.font.bold) style.fontWeight = 'bold';
            if (cell.font.italic) style.fontStyle = 'italic';
            if (cell.font.underline) style.textDecoration = 'underline';
          }
          cells.push(
            <td key={colNumber} className="excel-cell" style={style}>
              {getCellValue(cell)}
            </td>
          );
        }
      });
      rows.push(<tr key={rowNumber}>{cells}</tr>);
    });

    const images = imageUrls.filter(image => image.sheetName === worksheet.name);

    return (
      <div className="sheet-container" ref={tableRef}>
        <table className="excel-table">
          <tbody>{rows}</tbody>
        </table>
        {images.map((image, index) => (
          <ExcelImage key={index} image={image} tableRef={tableRef} worksheet={worksheet} />
        ))}
      </div>
    );
  };

  const ExcelImage = ({ image, tableRef, worksheet }) => {
    const [style, setStyle] = useState({});
  
    useEffect(() => {
      if (tableRef.current && image && image.range) {
        const table = tableRef.current;
        const { tl, br } = image.range;
        
        if (tl && br && typeof tl.row === 'number' && typeof tl.col === 'number' && 
            typeof br.row === 'number' && typeof br.col === 'number') {
          const startRow = Math.round(tl.row);
          const startCol = Math.round(tl.col);
          const endRow = Math.round(br.row);
          const endCol = Math.round(br.col);
  
          const startCell = table.querySelector(`tr:nth-child(${startRow}) td:nth-child(${startCol})`);
          const endCell = table.querySelector(`tr:nth-child(${endRow}) td:nth-child(${endCol})`);
  
          if (startCell && endCell) {
            const startRect = startCell.getBoundingClientRect();
            const endRect = endCell.getBoundingClientRect();
            const tableRect = table.getBoundingClientRect();
  
            const width = endRect.right - startRect.left;
            const height = endRect.bottom - startRect.top;
  
            // Calculate the scaling factor based on the original image dimensions
            const originalWidth = br.col - tl.col;
            const originalHeight = br.row - tl.row;
            const scaleX = width / originalWidth;
            const scaleY = height / originalHeight;
  
            setStyle({
              position: 'absolute',
              top: `${startRect.top - tableRect.top}px`,
              left: `${startRect.left - tableRect.left}px`,
              width: `${width}px`,
              height: `${height}px`,
              objectFit: 'contain',
              zIndex: 10,
              transform: `scale(${scaleX}, ${scaleY})`,
              transformOrigin: 'top left',
            });
          }
        }
      }
    }, [image, tableRef, worksheet]);
  
    return image && image.url ? <img src={image.url} style={style} alt="Excel Image" /> : null;
  };

  const handleSearch = () => {
    if (!workbook || !searchQuery) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const worksheet = workbook.worksheets[activeSheetIndex];
    const newResults = [];

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        const cellValue = getCellValue(cell);
        if (cellValue.toLowerCase().includes(searchQuery.toLowerCase())) {
          newResults.push({ row: rowNumber, col: colNumber, value: cellValue });
        }
      });
    });

    setSearchResults(newResults);
    setCurrentSearchIndex(newResults.length > 0 ? 0 : -1);
  };

  const highlightSearchResult = (result) => {
    if (!result) return;

    const table = document.querySelector('.sheet-container table');
    if (!table) return;

    const cell = table.rows[result.row - 1].cells[result.col - 1];
    cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cell.classList.add('search-highlight');
  };

  const handleNextResult = () => {
    if (searchResults.length === 0) return;
  
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    highlightSearchResult(searchResults[nextIndex]);
  };
  
  const handlePreviousResult = () => {
    if (searchResults.length === 0) return;
  
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    highlightSearchResult(searchResults[prevIndex]);
  };

  const handleResultClick = (resultKey) => {
    const settings = resultSettings[resultKey];
    if (settings) {
      const worksheet = workbook.getWorksheet(settings.sheetName);
      if (worksheet) {
        const sheetIndex = workbook.worksheets.findIndex(sheet => sheet.name === settings.sheetName);
        setActiveSheetIndex(sheetIndex);
        
        const columnsToHide = settings.hiddenColumns.split(',').map(col => parseInt(col.trim()));
        setHiddenColumns(columnsToHide);
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="App">
      <button className="logout" onClick={logout}>Logout</button>
      <h1>Welcome to Your Dashboard</h1>
      {!selectedFile ? (
        <div className="file-selection">
          <h2>Select a file to view:</h2>
          {clientFiles.map((file, index) => (
            <button key={index} onClick={() => {
              setSelectedFile(file);
              loadFile(file.url);
            }}>
              {file.name}
            </button>
          ))}
        </div>
      ) : (
        <>
          <button className="download" onClick={downloadExcel}>Download Excel</button>
          {sheets.length > 0 && (
            <div className="excel-viewer">
              <div className="nav">
                {sheets.map((sheet, index) => (
                  <button
                    key={index}
                    className={index === activeSheetIndex ? 'active' : ''}
                    onClick={() => handleSheetChange(index)}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
              <div className="result-buttons">
                {Object.keys(resultSettings).map(resultKey => (
                  <button key={resultKey} onClick={() => handleResultClick(resultKey)}>
                    Result {resultKey.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button onClick={handleSearch}>Search</button>
                <button onClick={handlePreviousResult} disabled={searchResults.length === 0}>Previous</button>
                <button onClick={handleNextResult} disabled={searchResults.length === 0}>Next</button>
                <span>{searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}</span>
              </div>
              {renderSheetContent()}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientDashboard;