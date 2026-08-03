import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getElectron } from '@/lib/electron';

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in Electron
    if (!getElectron()) return;

    // Listen for update events
    getElectron()?.onUpdateAvailable(() => {
      setUpdateAvailable(true);
      setError(null);
    });

    getElectron()?.onUpdateDownloaded(() => {
      setUpdateDownloaded(true);
      setUpdateAvailable(false);
      setError(null);
    });

    getElectron()?.onUpdateError((message: string) => {
      setError(message);
      setUpdateAvailable(false);
    });

    // Check for updates on component mount
    handleCheckUpdates();
  }, []);

  const handleCheckUpdates = async () => {
    if (!getElectron()) return;
    
    setChecking(true);
    try {
      await getElectron()?.checkForUpdates();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setChecking(false);
    }
  };

  const handleRestartAndInstall = () => {
    if (!getElectron()) return;
    getElectron()?.restartAndInstall();
  };

  if (!getElectron()) return null;

  if (updateDownloaded) {
    return (
      <Alert className="border-green-600 bg-green-50 dark:bg-green-950 mb-4">
        <RotateCcw className="h-4 w-4 text-green-600" />
        <AlertTitle>Update Ready to Install</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="text-sm mb-3">
            An update has been downloaded and is ready to install. Restart the app to apply it.
          </div>
          <Button 
            onClick={handleRestartAndInstall}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            <RotateCcw className="h-3 w-3 mr-2" />
            Restart & Install
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (updateAvailable) {
    return (
      <Alert className="border-blue-600 bg-blue-50 dark:bg-blue-950 mb-4">
        <Download className="h-4 w-4 text-blue-600" />
        <AlertTitle>Update Available</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="text-sm mb-3">
            A new version is available and will be downloaded in the background.
          </div>
          <Button 
            onClick={handleCheckUpdates}
            size="sm"
            variant="outline"
            disabled={checking}
          >
            {checking ? 'Downloading...' : 'Download Now'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950 mb-4">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle>Update Check Failed</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="text-sm mb-3">{error}</div>
          <Button 
            onClick={handleCheckUpdates}
            size="sm"
            variant="outline"
            disabled={checking}
          >
            {checking ? 'Checking...' : 'Try Again'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
