import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, secondaryAuth, storage } from '../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc, 
  deleteDoc, 
  setDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const addClient = async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        role: 'client',
      });
      return userCredential.user;
    } catch (error) {
      console.error("Error adding client:", error);
      throw error;
    }
  };

  const getClients = async () => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const updateClient = async (id, email, newPassword) => {
    try {
      await updateDoc(doc(db, 'users', id), { email });
      
      if (newPassword) {
        const clientDoc = await getDoc(doc(db, 'users', id));
        const clientData = clientDoc.data();
        const userCredential = await signInWithEmailAndPassword(secondaryAuth, clientData.email, clientData.currentPassword);
        await updatePassword(userCredential.user, newPassword);
        
        await updateDoc(doc(db, 'users', id), { currentPassword: newPassword });
      }
    } catch (error) {
      console.error("Error updating client:", error);
      throw error;
    }
  };

  const deleteClient = (id) => {
    return deleteDoc(doc(db, 'users', id));
  };

  const uploadClientFile = async (clientId, file) => {
    try {
      console.log("Starting file upload for client:", clientId);
      console.log("File object:", file);

      if (!file) {
        throw new Error("No file provided");
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user");
      }

      const fileRef = ref(storage, `files/${clientId}/${file.name}`);
      console.log("File reference created:", fileRef);
      
      const snapshot = await uploadBytes(fileRef, file);
      console.log("Upload snapshot:", snapshot);

      const fileUrl = await getDownloadURL(fileRef);
      console.log("File URL obtained:", fileUrl);

      await updateDoc(doc(db, 'users', clientId), { fileUrl });
      console.log("User document updated with file URL");

      return fileUrl;
    } catch (error) {
      console.error("Error in uploadClientFile:", error);
      throw error;
    }
  };

  const updateResultSettings = async (clientId, settings) => {
    try {
      await updateDoc(doc(db, 'users', clientId), { resultSettings: settings });
      console.log("Result settings updated for client:", clientId);
    } catch (error) {
      console.error("Error updating result settings:", error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    logout,
    addClient,
    getClients,
    updateClient,
    deleteClient,
    uploadClientFile,
    updateResultSettings
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};

export { AuthContext };