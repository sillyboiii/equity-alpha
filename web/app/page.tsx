import ResearchApp from "./components/ResearchApp";
import { AuthProvider } from "./components/AuthProvider";
import CloudSync from "./components/CloudSync";
import track from "./track.json";

export default function Home() {
  return (
    <AuthProvider>
      <CloudSync />
      <ResearchApp initialTrack={track} />
    </AuthProvider>
  );
}
