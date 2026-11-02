import { shuffle } from "./football-engine";
export type RivalryQuestion = {
  id: string;
  en: string;
  es: string;
  options: readonly [string, string, string, string];
  optionsEs?: readonly [string, string, string, string];
  correct: number;
  why: string;
  whyEs: string;
  source: string;
  url: string;
};
const utah =
  "https://static.utahutes.com/custompages/uteathletics_com/facilities/rice-eccles-stadium.html";
const byu = "https://byucougars.com/byu-football-quick-facts";
const olympics = "https://olympics.utah.edu/";
const rules =
  "https://ncaaorg.s3.amazonaws.com/championships/sports/football/rules/PRMFB_RulesBook.pdf";
export const RIVALRY_QUESTIONS: readonly RivalryQuestion[] = [
  {
    id: "utah-founded",
    en: "In which year was the University of Utah founded?",
    es: "¿En qué año se fundó la Universidad de Utah?",
    options: ["1850", "1875", "1896", "1927"],
    correct: 0,
    why: "The University of Utah was founded on February 28, 1850.",
    whyEs: "La Universidad de Utah se fundó el 28 de febrero de 1850.",
    source: "University of Utah",
    url: "https://about.utah.edu/",
  },
  {
    id: "utah-mascot",
    en: "Who is the University of Utah’s mascot?",
    es: "¿Quién es la mascota de la Universidad de Utah?",
    options: ["Cosmo", "Swoop", "Big Blue", "Benny"],
    correct: 1,
    why: "Swoop is the University of Utah’s mascot.",
    whyEs: "Swoop es la mascota de la Universidad de Utah.",
    source: "Utah Athletics",
    url: "https://utahutes.com/sports/cheerleading",
  },
  {
    id: "utah-home",
    en: "Where do the Utes play their home football games?",
    es: "¿Dónde juegan los Utes sus partidos de local?",
    options: ["Rice-Eccles Stadium", "LaVell Edwards Stadium", "Allegiant Stadium", "Rose Bowl"],
    correct: 0,
    why: "Rice-Eccles Stadium is the home of Utah football.",
    whyEs: "Rice-Eccles Stadium es la casa del fútbol americano de Utah.",
    source: "Utah Athletics",
    url: utah,
  },
  {
    id: "stadium-year",
    en: "In which year did Rice-Eccles Stadium open?",
    es: "¿En qué año abrió Rice-Eccles Stadium?",
    options: ["1988", "1998", "2002", "2012"],
    correct: 1,
    why: "The rebuilt Rice-Eccles Stadium opened in 1998.",
    whyEs: "El reconstruido Rice-Eccles Stadium abrió en 1998.",
    source: "Utah Athletics",
    url: utah,
  },
  {
    id: "olympic-year",
    en: "Which Winter Olympics used Rice-Eccles for their opening ceremony?",
    es: "¿Qué Juegos Olímpicos de Invierno celebraron su inauguración en Rice-Eccles?",
    options: ["1994", "1998", "2002", "2010"],
    correct: 2,
    why: "The stadium hosted the opening and closing ceremonies in 2002.",
    whyEs: "El estadio recibió las ceremonias de apertura y clausura en 2002.",
    source: "University of Utah",
    url: olympics,
  },
  {
    id: "byu-city",
    en: "Which Utah city is home to BYU?",
    es: "¿En qué ciudad de Utah está BYU?",
    options: ["Ogden", "Logan", "Salt Lake City", "Provo"],
    correct: 3,
    why: "BYU is located in Provo, Utah.",
    whyEs: "BYU está ubicada en Provo, Utah.",
    source: "BYU Athletics",
    url: byu,
  },
  {
    id: "byu-mascot",
    en: "What is the name of BYU’s mascot?",
    es: "¿Cómo se llama la mascota de BYU?",
    options: ["Cosmo", "Swoop", "Big Blue", "Benny"],
    correct: 0,
    why: "Cosmo is BYU’s cougar mascot.",
    whyEs: "Cosmo es el puma que representa a BYU.",
    source: "BYU Athletics",
    url: byu,
  },
  {
    id: "byu-nickname",
    en: "What is BYU’s team nickname?",
    es: "¿Cuál es el apodo del equipo de BYU?",
    options: ["Aggies", "Cougars", "Wildcats", "Bears"],
    correct: 1,
    why: "BYU’s athletic teams are the Cougars.",
    whyEs: "Los equipos deportivos de BYU son los Cougars.",
    source: "BYU Athletics",
    url: byu,
  },
  {
    id: "byu-stadium",
    en: "Which stadium is home to BYU football?",
    es: "¿En qué estadio juega BYU como local?",
    options: ["Rice-Eccles Stadium", "Maverik Stadium", "LaVell Edwards Stadium", "Reser Stadium"],
    correct: 2,
    why: "BYU plays at LaVell Edwards Stadium in Provo.",
    whyEs: "BYU juega en LaVell Edwards Stadium en Provo.",
    source: "BYU Athletics",
    url: byu,
  },
  {
    id: "byu-colors",
    en: "Which colors are listed for BYU?",
    es: "¿Cuáles son los colores de BYU?",
    options: ["Red and white", "Green and gold", "Orange and black", "Blue and white"],
    optionsEs: ["Rojo y blanco", "Verde y dorado", "Naranja y negro", "Azul y blanco"],
    correct: 3,
    why: "BYU lists blue and white as its colors.",
    whyEs: "BYU identifica azul y blanco como sus colores.",
    source: "BYU Athletics",
    url: byu,
  },
  {
    id: "byu-year",
    en: "In which year was BYU founded?",
    es: "¿En qué año se fundó BYU?",
    options: ["1875", "1850", "1901", "1927"],
    correct: 0,
    why: "BYU was founded on October 16, 1875.",
    whyEs: "BYU se fundó el 16 de octubre de 1875.",
    source: "BYU Athletics",
    url: byu,
  },
  {
    id: "touchdown",
    en: "How many points is a touchdown worth, before the try?",
    es: "¿Cuántos puntos vale un touchdown, antes del intento extra?",
    options: ["3", "6", "7", "8"],
    correct: 1,
    why: "A touchdown scores six points. The try is separate.",
    whyEs: "Un touchdown suma seis puntos. El intento extra es aparte.",
    source: "NCAA · Rule 8",
    url: rules,
  },
  {
    id: "field-goal",
    en: "How many points does a field goal score?",
    es: "¿Cuántos puntos suma un gol de campo?",
    options: ["1", "2", "3", "6"],
    correct: 2,
    why: "A field goal during normal play scores three points.",
    whyEs: "Un gol de campo durante el juego normal suma tres puntos.",
    source: "NCAA · Rule 8",
    url: rules,
  },
  {
    id: "safety",
    en: "How many points are awarded for a safety?",
    es: "¿Cuántos puntos se otorgan por un safety?",
    options: ["1", "3", "6", "2"],
    correct: 3,
    why: "A safety awards two points to the opponent.",
    whyEs: "Un safety otorga dos puntos al equipo rival.",
    source: "NCAA · Rule 8",
    url: rules,
  },
  {
    id: "try-kick",
    en: "A successful kick on a try after a touchdown scores…",
    es: "Una patada exitosa en el intento tras un touchdown suma…",
    options: ["1 point", "2 points", "3 points", "6 points"],
    optionsEs: ["1 punto", "2 puntos", "3 puntos", "6 puntos"],
    correct: 0,
    why: "A successful field goal on a try is worth one point.",
    whyEs: "Una patada exitosa en ese intento vale un punto.",
    source: "NCAA · Rule 8",
    url: rules,
  },
  {
    id: "try-run",
    en: "Running or passing into the end zone on the try scores…",
    es: "Llegar a la zona de anotación por carrera o pase en el intento extra suma…",
    options: ["1 point", "2 points", "3 points", "6 points"],
    optionsEs: ["1 punto", "2 puntos", "3 puntos", "6 puntos"],
    correct: 1,
    why: "Reaching the end zone on the try scores two points.",
    whyEs: "Llegar a la zona de anotación en el intento suma dos puntos.",
    source: "NCAA · Rule 8",
    url: rules,
  },
];
export type ShuffledQuestion = RivalryQuestion & { optionsOrder: number[] };
export function createRivalryDeck(random = Math.random): ShuffledQuestion[] {
  return shuffle(RIVALRY_QUESTIONS, random)
    .slice(0, 8)
    .map((q) => {
      const optionsOrder = shuffle([0, 1, 2, 3], random);
      return { ...q, optionsOrder, correct: optionsOrder.indexOf(q.correct) };
    });
}
