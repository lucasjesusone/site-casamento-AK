export interface StoryItem {
  title: string;
  text: string;
}

export interface EventItem {
  time: string;
  title: string;
  description: string;
}

export interface GalleryItem {
  title: string;
  accent: 'rose' | 'gold' | 'sage';
  imageUrl: string;
}

export const weddingData = {
  couple: {
    names: 'Ana Karinne & Lucas Gabriel',
    short: 'AK & LG',
    date: '10 de julho de 2027',
    headline: 'Vamos celebrar o começo da nossa história',
    subtitle:
      'Em um dia cheio de amor, música, flores, emoção e muita alegria, convidamos vocês para compartilhar conosco o início de uma nova etapa.',
    confirmEmail: 'confirmar@anakarinneelucasg.com.br'
  },
  palette: {
    rose: '#c98a84',
    blush: '#f3e4df',
    gold: '#d8bd88',
    sage: '#b6c7b3',
    ivory: '#f9f3ee',
    plum: '#4c3636',
    taupe: '#73615f'
  },
  location: {
    name: 'Local do casamento',
    address: 'Endereço do local',
    gpsUrl: 'https://share.google/VpGgtIwSPDm1kN9dO',
    watercolor: ['#f2d7d2', '#d9c4b5', '#c9d9cb', '#e8ccb0']
  },
  rsvp: {
    title: 'Confirme sua presença',
    description: 'A sua presença é muito importante para esse momento tão especial na nossa história.',
    email: 'confirmar@anakarinneelucasg.com.br'
  },
  media: {
    cloudBucket: 'https://images.unsplash.com',
    imageFallback:
      'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=900&q=80'
  },
  highlights: [
    'Cerimônia íntima e acolhedora',
    'Recepção com jantar, música e dança',
    'Um dia pensado com carinho para a nossa família e amigos'
  ],
  story: [
    {
      title: 'Como tudo começou',
      text: 'Tudo começou com uma conversa simples, uma troca de olhares e a certeza de que havia algo especial crescendo entre a gente.'
    },
    {
      title: 'O nosso amor',
      text: 'Cada passo dessa jornada foi construído com cumplicidade, respeito, gentileza e muito carinho — pilares que nos tornaram uma equipe.'
    },
    {
      title: 'O grande dia',
      text: 'No dia 10 de julho de 2027, queremos celebrar esse momento com as pessoas que fazem parte da nossa história e do nosso futuro.'
    }
  ] as StoryItem[],
  timeline: [
    {
      time: '16h30',
      title: 'Chegada dos convidados',
      description: 'Recepção e acolhimento com um ambiente acolhedor para todos.'
    },
    {
      time: '17h30',
      title: 'Cerimônia',
      description: 'O momento mais especial do nosso dia, celebrado com amor e emoção.'
    },
    {
      time: '19h00',
      title: 'Recepção',
      description: 'Jantar, conversa, música e a alegria de estar junto com quem amamos.'
    },
    {
      time: '22h00',
      title: 'Festa & dança',
      description: 'A noite continua com muita energia e celebração para fechar o dia em grande estilo.'
    }
  ] as EventItem[],
  gallery: [
    {
      title: 'Nosso começo',
      accent: 'rose',
      imageUrl:
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=900&q=80'
    },
    {
      title: 'Amor em família',
      accent: 'gold',
      imageUrl:
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80'
    },
    {
      title: 'Momentos felizes',
      accent: 'sage',
      imageUrl:
        'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=900&q=80'
    }
  ] as GalleryItem[]
};
