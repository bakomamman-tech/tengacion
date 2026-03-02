import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !promptEvent) {
    return null;
  }

  return (
    <button
      type="button"
      className="messenger-dock"
      style={{ right: 18, left: "auto", bottom: 18, position: "fixed", zIndex: 70 }}
      onClick={async () => {
        promptEvent.prompt();
        await promptEvent.userChoice;
        setVisible(false);
      }}
    >
      <span>Install Tengacion</span>
    </button>
  );
}
