import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    // Single point of entry for dynamic app settings
    api.getAppConfig()
      .then(cfg => setConfig(cfg))
      .catch(err => {
        console.warn('[ConfigContext] Failed to load remote config:', err.message);
      });
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);