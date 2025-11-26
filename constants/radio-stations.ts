export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  category: string;
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: "radio1",
    name: "Radio 1",
    streamUrl: "https://icecast.vrtcdn.be/radio1-high.mp3",
    category: "News & Talk",
  },
  {
    id: "radio1-classics",
    name: "Radio 1 - Classics",
    streamUrl: "https://icecast.vrtcdn.be/radio1_classics-high.mp3",
    category: "News & Talk",
  },
  {
    id: "klara",
    name: "Klara",
    streamUrl: "https://icecast.vrtcdn.be/klara-high.mp3",
    category: "Classical",
  },
  {
    id: "klara-continuo",
    name: "Klara Continuo",
    streamUrl: "https://icecast.vrtcdn.be/klaracontinuo-high.mp3",
    category: "Classical",
  },
  {
    id: "studio-brussel",
    name: "Studio Brussel",
    streamUrl: "https://icecast.vrtcdn.be/stubru-high.mp3",
    category: "Alternative",
  },
  {
    id: "studio-brussel-bruut",
    name: "Studio Brussel - Bruut",
    streamUrl: "https://icecast.vrtcdn.be/stubru_bruut-high.mp3",
    category: "Alternative",
  },
  {
    id: "de-tijdloze",
    name: "De Tijdloze",
    streamUrl: "https://icecast.vrtcdn.be/stubru_tijdloze-high.mp3",
    category: "Classic Hits",
  },
  {
    id: "radio-bene",
    name: "Radio Bene",
    streamUrl: "https://icecast.vrtcdn.be/radiobene-high.mp3",
    category: "Regional",
  },
  {
    id: "radio2-antwerpen",
    name: "Radio 2 Antwerpen",
    streamUrl: "https://icecast.vrtcdn.be/ra2ant-high.mp3",
    category: "Regional",
  },
  {
    id: "radio2-limburg",
    name: "Radio 2 Limburg",
    streamUrl: "https://icecast.vrtcdn.be/ra2lim-high.mp3",
    category: "Regional",
  },
  {
    id: "radio2-oost-vlaanderen",
    name: "Radio 2 Oost-Vlaanderen",
    streamUrl: "https://icecast.vrtcdn.be/ra2ovl-high.mp3",
    category: "Regional",
  },
  {
    id: "radio2-vlaams-brabant",
    name: "Radio 2 Vlaams-Brabant",
    streamUrl: "https://icecast.vrtcdn.be/ra2vlb-high.mp3",
    category: "Regional",
  },
  {
    id: "radio2-west-vlaanderen",
    name: "Radio 2 West-Vlaanderen",
    streamUrl: "https://icecast.vrtcdn.be/ra2wvl-high.mp3",
    category: "Regional",
  },
  {
    id: "radio2-relax",
    name: "Radio 2 Relax",
    streamUrl: "https://icecast.vrtcdn.be/radio2_relax-high.mp3",
    category: "Easy Listening",
  },
];

export const RADIO_CATEGORIES = [
  "All",
  "News & Talk",
  "Classical",
  "Alternative",
  "Classic Hits",
  "Regional",
  "Easy Listening",
];
