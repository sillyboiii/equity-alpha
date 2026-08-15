import ResearchApp from "./components/ResearchApp";
import track from "./track.json";

export default function Home() {
  return <ResearchApp initialTrack={track} />;
}
