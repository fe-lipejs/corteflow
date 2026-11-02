import { useState, useEffect, useMemo } from 'react';
import AdminPageHeader from './components/AdminPageHeader';
import { supabase } from '../../integrations/supabase/client';
import toast from 'react-hot-toast';
import {
  Target,
  Users,
  Compass,
  GitBranch,
  MessageSquare,
  ShieldAlert,
  Calculator,
  CheckSquare,
  BookOpen,
  Plus,
  Search,
  Copy,
  ExternalLink,
  Phone,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Download,
  Filter,
  RefreshCw,
  Send,
  HelpCircle,
  Eye,
  ChevronDown,
  ChevronRight,
  DollarSign
} from 'lucide-react';

const InstagramIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

interface ProspectLead {
  id: string;
  business_name: string;
  contact_name: string | null;
  business_type: string;
  whatsapp: string | null;
  instagram: string | null;
  channel: string;
  score: number;
  stage: string;
  estimated_value: number;
  demo_url: string | null;
  next_follow_up: string | null;
  notes: string | null;
  objection_faced: string | null;
  created_at: string;
}

const STAGES_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  novo: { label: 'Novo Lead', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  contatado: { label: 'Primeiro Contato', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  respondeu: { label: 'Respondeu / Conversa', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  qualificado: { label: 'Qualificado (Tem Dor)', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  demo_enviada: { label: 'Demonstração Enviada', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  teste_ativo: { label: 'Teste Assistido (7d)', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  fechado: { label: 'Assinatura Fechada 🚀', color: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40' },
  perdido: { label: 'Perdido / Desistiu', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

const PROCESS_MAP_STAGES = [
  {
    ico: '🔎',
    title: '1. Prospecção Ativa',
    objective: 'Ter uma lista curta de 15 a 25 pessoas CERTAS para abordar hoje — qualidade antes de quantidade.',
    whatToDo: [
      'Buscar 25 perfis no Google Maps e Instagram (#esmalteria, #barbearia, #salaodebeleza no seu bairro/cidade).',
      'Avaliar os sinais no perfil: "agenda pelo WhatsApp/direct", stories de "horários disponíveis", sem link na bio.',
      'Calcular o Score de Qualificação antes de mandar qualquer mensagem.'
    ],
    script: 'Nesta etapa você apenas lista e analisa o perfil (olhe pelo menos 3 posts/stories para citar um detalhe real).',
    avoid: 'Mandar 500 mensagens genéricas copiadas e coladas ou comprar listas frias.'
  },
  {
    ico: '👋',
    title: '2. Primeiro Contato',
    objective: 'Conseguir UMA resposta. Nunca tente vender nada na primeira mensagem.',
    whatToDo: [
      'Enviar mensagem curta e personalizada com UMA pergunta sobre como ela marca horários hoje.',
      'Citar um detalhe real e recente do trabalho dela (elogio sincero).',
      'Mandar em horário comercial fora dos horários de pico (manicures/barbeiros evite sábado).'
    ],
    script: 'Oi, [Nome]! Vi seu trabalho no Instagram, ficou incrível o [detalhe real do post]. Uma curiosidade rápida: quando uma cliente nova quer marcar com você, ela te chama no WhatsApp e você responde na mão, ou ela já consegue escolher o horário sozinha?',
    avoid: 'Começar com "Somos uma plataforma líder...", mandar link direto ou áudio longo.'
  },
  {
    ico: '📩',
    title: '3. Resposta & Aprofundamento',
    objective: 'Manter a conversa viva e entender a dor da rotina sem despejar o sistema.',
    whatToDo: [
      'Responder em até 1 hora durante o horário comercial.',
      'Espelhar o tom da profissional e reagir ao que ela disse.',
      'Fazer a segunda pergunta (a dor real: faltas, tempo gasto no WhatsApp, horários cruzados).'
    ],
    script: 'Entendi! E isso te toma muito tempo no dia? Me conta uma coisa: quando uma cliente falta ou desmarca em cima da hora, o que acontece com aquele horário?',
    avoid: 'Mandar link logo após o "oi" ou dar lição de moral sobre o método dela.'
  },
  {
    ico: '🎯',
    title: '4. Qualificação (Validação da Dor)',
    objective: 'Decidir se vale seu tempo: ela sente a dor, decide sozinha e atende clientes regularmente?',
    whatToDo: [
      'Confirmar 3 coisas: dor de faltas/tempo, quem decide no negócio e quantas pessoas atendem.',
      'Anotar os números dela: quantas faltas por semana e quanto vale um horário vago.'
    ],
    script: 'Quantas vezes por semana, mais ou menos, uma cliente falta ou desmarca em cima da hora? E quanto vale um horário desses pra você?',
    avoid: 'Tentar vender para quem não sente dor ou insistir após ela dizer que a rotina está perfeita.'
  },
  {
    ico: '🪄',
    title: '5. Apresentação Cirúrgica',
    objective: 'Ligar a dor DELA a UMA única solução da plataforma em 3 frases.',
    whatToDo: [
      'Repetir o problema com as próprias palavras dela.',
      'Apresentar apenas 1 ou 2 funções ligadas à dor.',
      'Oferecer para ela ver como ficaria com o nome do salão/estúdio dela.'
    ],
    script: 'Entendi perfeitamente. O que montei resolve exatamente isso: você coloca um link na bio, a cliente escolhe o serviço e o horário sozinha, só aparecem horários livres e já cai direto na sua agenda. Quer ver como ficaria com o seu nome? Eu monto rapidinho e te mando.',
    avoid: 'Listar 20 funcionalidades, falar de banco de dados, Stripe Connect ou termos técnicos.'
  },
  {
    ico: '📱',
    title: '6. Demonstração Personalizada',
    objective: 'Fazer ela VER e SENTIR a página dela funcionando no celular dela.',
    whatToDo: [
      'Gerar o Portal Demo com os dados públicos dela (nome, serviços e logo).',
      'Mandar o link para ela abrir no celular e agendar como se fosse uma cliente.',
      'Mostrar a notificação caindo na agenda em tempo real.'
    ],
    script: 'Montei uma página de exemplo com o seu nome pra você ver como ficaria: [Link]. A cliente escolhe o serviço, o dia e o horário sozinha e já aparece na sua agenda. Se não fizer sentido pra sua rotina, é só me avisar 🙂',
    avoid: 'Fazer tour longo por todas as telas do sistema ou usar fotos sem autorização.'
  },
  {
    ico: '🛡️',
    title: '7. Contorno de Objeções',
    objective: 'Entender a dúvida real por trás da hesitação e propor o menor próximo passo.',
    whatToDo: [
      'Acolher e perguntar: "O que te preocupa mais?".',
      'Comparar o valor da assinatura com apenas 1 corte ou 1 serviço dela no mês.',
      'Propor o teste de 7 dias com configuração assistida gratuita.'
    ],
    script: 'Faz todo sentido. Me conta: o que você ainda gostaria de ter certeza antes de testar na prática?',
    avoid: 'Discutir para "vencer" a discussão ou dar desconto de imediato na primeira resposta.'
  },
  {
    ico: '🤝',
    title: '8. Fechamento & Onboarding (48h)',
    objective: 'Fazer a primeira cliente DELA agendar sozinha pelo link em até 48h.',
    whatToDo: [
      'Ajudar a cadastrar os 3 a 5 principais serviços e horários de atendimento.',
      'Colocar o link na bio do Instagram e na mensagem de ausência do WhatsApp Business.',
      'Pedir para ela postar um story anunciando a novidade com o link.'
    ],
    script: 'Tudo pronto! Seu link oficial é [Link]. Coloca na bio do Instagram e manda um story avisando as clientes hoje. Amanhã eu te chamo pra acompanhar se alguma cliente já marcou sozinha!',
    avoid: 'Entregar o sistema e sumir sem acompanhar a primeira semana.'
  }
];

const DECISION_TREE_NODES: Record<string, { title: string; goal: string; tips: string[]; msg: string; options: Array<{ label: string; to: string }> }> = {
  root: {
    title: 'Qual é a situação da conversa com o lead agora?',
    goal: 'Identifique o momento exato e execute a resposta calibrada.',
    tips: ['Selecione a reação mais parecida com o que a profissional disse.'],
    msg: '',
    options: [
      { label: '✅ Respondeu positivamente ("sim, respondo no WhatsApp")', to: 'pos' },
      { label: '👀 Visualizou a mensagem e não respondeu', to: 'seen' },
      { label: '🤔 Demonstrou curiosidade ("como funciona isso?")', to: 'cur' },
      { label: '💰 Perguntou o preço logo de início ("quanto custa?")', to: 'price' },
      { label: '📱 Já usa outro sistema ou caderno ("já tenho aplicativo")', to: 'other' },
      { label: '💬 "Prefiro marcar tudo pelo WhatsApp direto"', to: 'wa' },
      { label: '🚫 "Não tenho interesse no momento"', to: 'no' },
      { label: '👻 Demonstrou interesse na demo e sumiu', to: 'ghost' },
    ]
  },
  pos: {
    title: 'Respondeu Positivamente',
    goal: 'Transformar a abertura em conversa sobre a rotina dela antes de apresentar o sistema.',
    tips: ['Responda em até 1 hora.', 'Reaja ao que ela disse e faça UMA pergunta sobre a dor.', 'Ainda sem link, sem preço.'],
    msg: 'Que legal! E como funciona hoje: ela te chama, você para o que tá fazendo, olha a agenda e responde os horários? Quanto tempo isso te toma por dia, mais ou menos?',
    options: [
      { label: 'Ela descreveu uma dor concreta (faltas, correria)', to: 'qual' },
      { label: 'Resposta vaga ("ah, é normal", "tranquilo")', to: 'vague' },
      { label: 'Voltar ao início', to: 'root' },
    ]
  },
  vague: {
    title: 'Resposta Vaga',
    goal: 'Tirar uma resposta concreta com números simples sem pressionar.',
    tips: ['Faça uma pergunta fácil de responder com um número.'],
    msg: 'Só pra eu entender melhor sua rotina: nessa última semana, quantas clientes te chamaram pra marcar horário? Mais ou menos, só pra ter uma ideia.',
    options: [
      { label: 'Deu um número ou citou rotina', to: 'qual' },
      { label: 'Parou de responder', to: 'seen' },
      { label: 'Voltar ao início', to: 'root' },
    ]
  },
  qual: {
    title: 'Qualificação: Identificando o Custo do Problema',
    goal: 'Quantificar o prejuízo de faltas e tempo perdido.',
    tips: ['Anote os números dela para usar na ancoragem de preço.'],
    msg: 'Quantas vezes por semana, mais ou menos, alguma cliente falta ou desmarca em cima da hora? E quanto vale em média um horário desses pra você?',
    options: [
      { label: 'Tem dor clara (ex: 2 faltas = R$ 100+ perdidos)', to: 'apres' },
      { label: 'Disse que quase não tem faltas nem dor', to: 'semdor' },
      { label: 'Voltar ao início', to: 'root' },
    ]
  },
  apres: {
    title: 'Apresentação em 3 Frases',
    goal: 'Ligar a dor dela à solução e oferecer a demonstração com o nome dela.',
    tips: ['Fale de resultado, não de tecnologia.'],
    msg: 'Então o que montei resolve justamente isso: você coloca um link na bio, a cliente escolhe serviço e horário sozinha, só aparecem horários livres e já bloqueia na sua agenda. Quer ver como ficaria com o seu nome? Eu monto e te mando.',
    options: [
      { label: 'Aceitou ver ("quero sim")', to: 'demoOffer' },
      { label: 'Perguntou o preço', to: 'price' },
      { label: 'Hesitou ou tem dúvidas', to: 'root' },
    ]
  },
  demoOffer: {
    title: 'Envio da Demonstração',
    goal: 'Apresentar a demonstração no menor atrito possível.',
    tips: ['Gere o portal demo na aba Portais Demo do Super Admin.'],
    msg: 'Montei uma página de exemplo com os seus serviços pra você olhar no celular: [Link]. A cliente escolhe o serviço e o horário e já bloqueia automático. Olha com calma e me fala o que achou!',
    options: [
      { label: 'Gostou da página', to: 'trial' },
      { label: 'Viu e não respondeu mais', to: 'ghost' },
      { label: 'Achou caro', to: 'price' },
    ]
  },
  trial: {
    title: 'Fechamento do Teste Assistido (7 Dias)',
    goal: 'Ativar o salão com suporte direto e configuração assistida.',
    tips: ['Cadastre os 3 principais serviços e coloque o link na bio.'],
    msg: 'Perfeito! Fazemos assim: me manda a listinha dos seus serviços principais com preço e tempo médio, e seus horários. Eu deixo tudo configuradinho hoje e você testa 7 dias na prática com suas clientes reais.',
    options: [
      { label: 'Reiniciar árvore de decisão', to: 'root' }
    ]
  },
  seen: {
    title: 'Visualizou e Não Respondeu',
    goal: 'Dar mais uma chance com valor e leveza, sem cobrança.',
    tips: ['Aguarde 24h a 48h antes de enviar.', 'Máximo de 3 tentativas elegantes.'],
    msg: 'Oi, [Nome]! Sei que a correria de atendimento é puxada. Montei aqui como ficaria uma página com seus serviços, só pra você olhar quando tiver um minutinho: [Link]. Se não fizer sentido, é só me avisar que não incomodo mais 🙂',
    options: [
      { label: 'Respondeu', to: 'pos' },
      { label: 'Continuou em silêncio após 3 toques (Arquivar)', to: 'root' },
    ]
  },
  price: {
    title: 'Perguntou o Preço de Cara',
    goal: 'Responder com total transparência e ancorar contra um serviço dela.',
    tips: ['Nunca esconda o preço; compare com 1 corte ou manicure no mês.'],
    msg: 'O plano individual para quem atende sozinha é apenas R$ 27/mês (ou R$ 77 para equipe completa), com 7 dias de teste grátis. Pra você ter uma ideia: é menos que o valor de um único atendimento no mês todo! Quer dar uma olhada como fica com o seu nome antes de decidir qualquer coisa?',
    options: [
      { label: 'Aceitou olhar a página', to: 'demoOffer' },
      { label: 'Disse que está sem grana', to: 'semdor' },
      { label: 'Voltar ao início', to: 'root' },
    ]
  },
  other: {
    title: 'Já Usa Outro Sistema ou Caderno',
    goal: 'Descobrir se está satisfeita sem criticar a ferramenta atual.',
    tips: ['Descubra o que ela mais gosta e o que mais incomoda.'],
    msg: 'Que ótimo que você já tem organização! E você tá 100% satisfeita com ele? Tem algo que te incomoda (cliente reclamando de ter que baixar app, taxas ou suporte)? Pergunto porque no nosso a cliente agenda direto pelo link sem baixar nada.',
    options: [
      { label: 'Tem reclamações do app atual', to: 'demoOffer' },
      { label: 'Tá super satisfeita (Arquivar e falar em 60 dias)', to: 'root' },
    ]
  },
  wa: {
    title: '"Prefiro Marcar Tudo Pelo WhatsApp"',
    goal: 'Validar o costume e mostrar que o link é um parceiro que ajuda a atender mais.',
    tips: ['Não desmereça o WhatsApp; mostre que evita perder cliente nova de madrugada.'],
    msg: 'Faz todo sentido, o WhatsApp funciona muito bem! A ideia não é você sair dele, e sim você não perder aquela cliente nova que te manda mensagem às 23h ou enquanto você tá atendendo. Ela clica no link da bio e marca na hora.',
    options: [
      { label: 'Concordou que perde cliente de noite/folga', to: 'demoOffer' },
      { label: 'Voltar ao início', to: 'root' },
    ]
  },
  no: {
    title: 'Sem Interesse no Momento',
    goal: 'Encerrar com profissionalismo e deixar as portas abertas.',
    tips: ['A reputação e a simpatia valem mais do que qualquer venda forçada.'],
    msg: 'Tranquilo, [Nome]! Muito obrigado por responder com sinceridade. Se um dia a rotina de mensagens ficar pesada ou quiser organizar a agenda, tô por aqui. Muito sucesso no seu trabalho! ✨',
    options: [
      { label: 'Voltar ao início', to: 'root' }
    ]
  },
  ghost: {
    title: 'Viu a Demonstração e Sumiu',
    goal: 'Reativar com um motivo real ou data específica.',
    tips: ['Aguarde 3 a 5 dias. Use gancho de feriado ou fim de semana.'],
    msg: 'Oi, [Nome]! Lembrei de você por conta da correria desse fim de semana. Conseguiu ver a página de exemplo que te mandei? Ficou alguma dúvida sobre como funcionaria pra você?',
    options: [
      { label: 'Respondeu com dúvida', to: 'apres' },
      { label: 'Voltar ao início', to: 'root' },
    ]
  },
  semdor: {
    title: 'Sem Dor Declarada',
    goal: 'Não insistir onde não há necessidade e focar tempo em outros leads.',
    tips: ['Agradeça, registre no CRM e programe follow-up em 60 dias.'],
    msg: 'Maravilha, que bom que suas clientes são pontuais e tá tudo sob controle! Vou deixar meu contato aqui. Se um dia precisar ou quiser testar, é só me dar um toque!',
    options: [
      { label: 'Voltar ao início', to: 'root' }
    ]
  }
};

const OBJECTIONS_LIBRARY = [
  {
    q: '"Eu já anoto tudo no WhatsApp ou no caderno."',
    mindset: 'Funciona pra mim, tenho medo de mudar o que já tô acostumada.',
    neverSay: '"Isso é amador, você tá perdendo dinheiro."',
    howToRespond: 'Valide o hábito dela. Mostre que o link é um caminho extra para quem tem pressa ou chama fora do horário.',
    script: 'Faz todo sentido, o WhatsApp funciona mesmo! A ideia não é tirar você dele, e sim não te deixar presa no celular enquanto atende ou descansa. Quantas mensagens de "tem horário amanhã?" você responde por dia mais ou menos?',
    nextStep: 'Se o volume for alto, ofereça montar a página grátis para ela ver.'
  },
  {
    q: '"Está caro."',
    mindset: 'Não tenho certeza se vai se pagar ou meu caixa tá curto este mês.',
    neverSay: 'Dar desconto na hora ou dizer que "tá de graça".',
    howToRespond: 'Descubra se a dúvida é o valor financeiro ou o retorno. Compare com o valor de um único corte/serviço dela.',
    script: 'Entendo perfeitamente. Posso te fazer uma pergunta sincera? Se o sistema evitar que UMA única cliente falte no mês inteiro, ele já não se pagou e ainda sobrou lucro? Nosso plano de R$ 27 é menos que uma manicure ou corte simples.',
    nextStep: 'Ofereça os 7 dias de teste assistido sem cartão de crédito.'
  },
  {
    q: '"Não sei mexer com tecnologia / sou ruim de computador."',
    mindset: 'Vou me embananar, perder tempo e passar vergonha.',
    neverSay: '"É super fácil, qualquer criança mexe."',
    howToRespond: 'Assuma a responsabilidade: você configura tudo para ela por telefone ou chamada de 10 minutos.',
    script: 'Você usa WhatsApp e posta no Instagram? Se você sabe fazer isso, você já sabe mexer no sistema! E o melhor: você não precisa configurar nada, eu deixo tudo prontinho com seus preços e horários pra você.',
    nextStep: 'Peça uma foto da tabela de preços dela e marque os 10 minutos de configuração.'
  },
  {
    q: '"Minhas clientes não vão saber usar isso."',
    mindset: 'Minhas clientes são mais velhas ou preferem falar comigo.',
    neverSay: 'Dizer que "hoje em dia todo mundo usa app".',
    howToRespond: 'Concorde que algumas clientes antigas vão continuar no WhatsApp, mas as novas e as que trabalham vão adorar agendar de madrugada.',
    script: 'Você tem toda razão, algumas clientes mais antigas vão preferir te chamar mesmo e você continua marcando elas na mão. Mas a cliente nova que te acha no Instagram quer rapidez. Ela clica, escolhe o horário e confirma em 30 segundos sem nem precisar baixar aplicativo.',
    nextStep: 'Proponha testar o link só com as clientes novas do Instagram por 1 semana.'
  },
  {
    q: '"Vou pensar / depois eu vejo."',
    mindset: 'Tem uma dúvida que não quis dizer, ou só quer encerrar a conversa por educação.',
    neverSay: '"Mas vai pensar no que? A promoção acaba hoje."',
    howToRespond: 'Descubra com delicadeza qual é a dúvida escondida (preço, tempo ou medo técnico).',
    script: 'Com certeza! Só pra eu te ajudar na sua avaliação: o que você ainda gostaria de ter mais certeza? (a) se as clientes vão usar, (b) se vale o investimento, ou (c) se vai te dar trabalho pra começar? Me conta pra eu te mandar a informação certinha.',
    nextStep: 'Combine uma data exata: "Posso te dar um toque na quinta-feira à tarde pra gente conversar rapidinho?".'
  },
  {
    q: '"Já uso outro aplicativo (ex: Trinks, Booksy, etc)."',
    mindset: 'Já resolvi isso, trocar dá preguiça.',
    neverSay: 'Criticar o concorrente ou falar mal.',
    howToRespond: 'Pergunte o que ela mais gosta e o que mais incomoda no sistema atual (ex: cliente tendo que baixar app, taxas).',
    script: 'Legal demais que você já é organizada com sistema! E me conta: tá 100% satisfeita ou tem algo que te chateia nele? (muitas profissionais me contam que as clientes reclamam de ter que baixar app e criar senha só pra marcar).',
    nextStep: 'Se ela reclamar de algo, mostre que no seu sistema não exige app nem senha.'
  }
];

const SCORE_QUESTIONS = [
  { text: 'Perfil ativo no Instagram (postou nos últimos 14 dias)', points: 2 },
  { text: 'WhatsApp ou telefone de contato explícito na bio', points: 1 },
  { text: 'Agendamento feito na mão por direct ou link wa.me direto', points: 3 },
  { text: 'Stories recentes anunciando "horários livres" ou "agenda aberta"', points: 2 },
  { text: 'Já fez desabafo/stories sobre cliente que faltou ou furou', points: 3 },
  { text: 'Tem de 2 a 5 profissionais trabalhando no espaço', points: 2 },
  { text: 'Atende sozinha e apresenta fotos de ótima qualidade', points: 1 },
  { text: 'Já usa link de sistema concorrente estabelecido na bio', points: -3 },
  { text: 'Perfil parado há mais de 30 dias sem publicações', points: -3 },
  { text: 'É rede franqueada grande (decisão de compra muito longe)', points: -2 },
];

export default function AdminCaptacao() {
  const [activeTab, setActiveTab] = useState<'crm' | 'playbook' | 'arvore' | 'scripts' | 'objecoes' | 'score' | 'checklist' | 'simulacoes'>('crm');
  
  // CRM Database state
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');

  // New Lead Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    business_name: '',
    contact_name: '',
    business_type: 'barbearia',
    whatsapp: '',
    instagram: '',
    channel: 'Instagram',
    score: 0,
    stage: 'novo',
    estimated_value: 0,
    demo_url: '',
    next_follow_up: '',
    notes: '',
    objection_faced: ''
  });

  // Scripts dynamic tags
  const [scriptTags, setScriptTags] = useState({
    nome: '',
    negocio: '',
    bairro: '',
    link: '',
    seu_nome: 'Felipe'
  });

  // Decision Tree state
  const [treeNodeKey, setTreeNodeKey] = useState('root');

  // Objection search
  const [objectionSearch, setObjectionSearch] = useState('');

  // Score checklist state
  const [scoreChecked, setScoreChecked] = useState<Record<number, boolean>>({});

  // Daily checklist state
  const [dailyTasks, setDailyTasks] = useState<Record<number, boolean>>({});

  // Fetch leads from database
  const fetchLeads = async () => {
    try {
      setLoadingLeads(true);
      const { data, error } = await supabase
        .from('cliente_captacao')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads((data as ProspectLead[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar leads:', err);
      toast.error('Erro ao carregar leads do CRM: ' + (err.message || ''));
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Save new lead
  const handleSaveNewLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.business_name.trim()) {
      toast.error('Informe o nome do estabelecimento');
      return;
    }

    try {
      setSavingLead(true);
      const { error } = await supabase
        .from('cliente_captacao')
        .insert([{
          business_name: newLead.business_name.trim(),
          contact_name: newLead.contact_name.trim() || null,
          business_type: newLead.business_type,
          whatsapp: newLead.whatsapp.trim() || null,
          instagram: newLead.instagram.trim() || null,
          channel: newLead.channel,
          score: Number(newLead.score) || 0,
          stage: newLead.stage,
          estimated_value: Number(newLead.estimated_value) || 0,
          demo_url: newLead.demo_url.trim() || null,
          next_follow_up: newLead.next_follow_up || null,
          notes: newLead.notes.trim() || null,
          objection_faced: newLead.objection_faced.trim() || null
        }]);

      if (error) throw error;

      toast.success('Lead cadastrado no CRM com sucesso!');
      setIsModalOpen(false);
      setNewLead({
        business_name: '',
        contact_name: '',
        business_type: 'barbearia',
        whatsapp: '',
        instagram: '',
        channel: 'Instagram',
        score: 0,
        stage: 'novo',
        estimated_value: 0,
        demo_url: '',
        next_follow_up: '',
        notes: '',
        objection_faced: ''
      });
      fetchLeads();
    } catch (err: any) {
      console.error('Erro ao salvar lead:', err);
      toast.error('Erro ao salvar lead: ' + err.message);
    } finally {
      setSavingLead(false);
    }
  };

  // Update lead stage
  const handleUpdateStage = async (id: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('cliente_captacao')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l));
      toast.success('Status atualizado!');
    } catch (err: any) {
      toast.error('Erro ao atualizar estágio: ' + err.message);
    }
  };

  // Update follow-up date
  const handleUpdateFollowUp = async (id: string, date: string) => {
    try {
      const { error } = await supabase
        .from('cliente_captacao')
        .update({ next_follow_up: date || null, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? { ...l, next_follow_up: date || null } : l));
      toast.success('Follow-up atualizado!');
    } catch (err: any) {
      toast.error('Erro ao salvar follow-up: ' + err.message);
    }
  };

  // Delete lead
  const handleDeleteLead = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente excluir o lead "${name}" do CRM?`)) return;
    try {
      const { error } = await supabase.from('cliente_captacao').delete().eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.success('Lead removido do CRM.');
    } catch (err: any) {
      toast.error('Erro ao excluir lead: ' + err.message);
    }
  };

  // Copy text helper
  const copyToClipboard = (text: string) => {
    let replaced = text;
    if (scriptTags.nome) replaced = replaced.split('[Nome]').join(scriptTags.nome);
    if (scriptTags.negocio) replaced = replaced.split('[Negócio]').join(scriptTags.negocio);
    if (scriptTags.bairro) replaced = replaced.split('[Bairro]').join(scriptTags.bairro);
    if (scriptTags.link) replaced = replaced.split('[Link]').join(scriptTags.link);
    if (scriptTags.seu_nome) replaced = replaced.split('[Seu nome]').join(scriptTags.seu_nome);

    navigator.clipboard.writeText(replaced);
    toast.success('Mensagem copiada para a área de transferência! ✨');
  };

  // Open WhatsApp direct
  const openWhatsApp = (phone: string | null, textTemplate?: string) => {
    if (!phone) {
      toast.error('Este lead não tem WhatsApp informado.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    let msg = textTemplate || '';
    if (scriptTags.nome) msg = msg.split('[Nome]').join(scriptTags.nome);
    if (scriptTags.negocio) msg = msg.split('[Negócio]').join(scriptTags.negocio);
    if (scriptTags.bairro) msg = msg.split('[Bairro]').join(scriptTags.bairro);
    if (scriptTags.link) msg = msg.split('[Link]').join(scriptTags.link);
    if (scriptTags.seu_nome) msg = msg.split('[Seu nome]').join(scriptTags.seu_nome);

    const url = `https://wa.me/55${cleanPhone.replace(/^55/, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Calculated metrics
  const metrics = useMemo(() => {
    const total = leads.length;
    const contatados = leads.filter(l => l.stage !== 'novo').length;
    const demos = leads.filter(l => ['demo_enviada', 'teste_ativo', 'fechado'].includes(l.stage)).length;
    const fechados = leads.filter(l => l.stage === 'fechado').length;
    const conversao = total > 0 ? ((fechados / total) * 100).toFixed(1) : '0';
    return { total, contatados, demos, fechados, conversao };
  }, [leads]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchSearch = searchFilter === '' ||
        lead.business_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (lead.contact_name && lead.contact_name.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (lead.instagram && lead.instagram.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (lead.whatsapp && lead.whatsapp.includes(searchFilter));

      const matchStage = stageFilter === 'todos' || lead.stage === stageFilter;
      const matchType = typeFilter === 'todos' || lead.business_type === typeFilter;

      return matchSearch && matchStage && matchType;
    });
  }, [leads, searchFilter, stageFilter, typeFilter]);

  // Score calculation
  const calculatedScore = useMemo(() => {
    return SCORE_QUESTIONS.reduce((acc, q, idx) => {
      return acc + (scoreChecked[idx] ? q.points : 0);
    }, 0);
  }, [scoreChecked]);

  const scoreBadge = useMemo(() => {
    if (calculatedScore >= 8) return { letter: 'A', text: 'Nota A — Prioridade Máxima (Abordar Hoje)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (calculatedScore >= 4) return { letter: 'B', text: 'Nota B — Boa Oportunidade (Fila Ativa)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    return { letter: 'C', text: 'Nota C — Prioridade Baixa ou Fria', color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
  }, [calculatedScore]);

  // Export CSV
  const exportCsv = () => {
    if (leads.length === 0) {
      toast.error('Nenhum lead para exportar.');
      return;
    }
    const headers = ['Nome Estabelecimento', 'Contato', 'Tipo', 'WhatsApp', 'Instagram', 'Canal', 'Score', 'Estágio', 'Follow-up', 'Anotações'];
    const rows = leads.map(l => [
      `"${l.business_name.replace(/"/g, '""')}"`,
      `"${(l.contact_name || '').replace(/"/g, '""')}"`,
      `"${l.business_type}"`,
      `"${l.whatsapp || ''}"`,
      `"${l.instagram || ''}"`,
      `"${l.channel}"`,
      l.score,
      `"${STAGES_CONFIG[l.stage]?.label || l.stage}"`,
      `"${l.next_follow_up || ''}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_captacao_navalha_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Planilha CSV exportada com sucesso!');
  };

  return (
    <div className="space-y-6 pb-20 text-zinc-100 font-sans">
      {/* Header */}
      <AdminPageHeader
        title="Máquina de Captação & CRM"
        subtitle="Playbook completo de prospecção comercial, scripts validados, simulador de objeções e funil de vendas integrado ao banco de dados."
        icon={<Target className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Exportar CSV
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Novo Lead
            </button>
          </div>
        }
      />

      {/* KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1 text-xs font-medium">
            <span>Leads no Funil</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.total}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Total cadastrado</p>
        </div>

        <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1 text-xs font-medium">
            <span>Contatados</span>
            <Send className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.contatados}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Abordagens ativas</p>
        </div>

        <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1 text-xs font-medium">
            <span>Demos Enviadas</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.demos}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Portais personalizados</p>
        </div>

        <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1 text-xs font-medium">
            <span>Assinaturas Fechadas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics.fechados}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Novos clientes ativos</p>
        </div>

        <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-zinc-400 mb-1 text-xs font-medium">
            <span>Taxa de Conversão</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.conversao}%</div>
          <p className="text-[11px] text-zinc-500 mt-1">Fechados / Total</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/10">
        {[
          { id: 'crm', label: 'CRM & Pipeline', icon: Users },
          { id: 'playbook', label: '8 Etapas do Processo', icon: Compass },
          { id: 'arvore', label: 'Árvore de Decisão', icon: GitBranch },
          { id: 'scripts', label: 'Biblioteca de Scripts', icon: MessageSquare },
          { id: 'objecoes', label: 'Manual de Objeções', icon: ShieldAlert },
          { id: 'score', label: 'Calculadora de Score', icon: Calculator },
          { id: 'checklist', label: 'Rotina & Checklist', icon: CheckSquare },
          { id: 'simulacoes', label: 'Treino Visual', icon: BookOpen },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CRM & PIPELINE DE LEADS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'crm' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por salão, responsável, WhatsApp ou Instagram..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#13131A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={stageFilter}
                onChange={e => setStageFilter(e.target.value)}
                className="px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todos os Estágios</option>
                {Object.entries(STAGES_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="barbearia">Barbearias</option>
                <option value="salao">Salões de Beleza</option>
                <option value="esmalteria">Esmalterias / Manicures</option>
                <option value="outro">Outros</option>
              </select>

              <button
                onClick={fetchLeads}
                title="Recarregar"
                className="p-2 bg-[#13131A] border border-white/10 hover:bg-white/[0.08] text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLeads ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-[#0E0E14] text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Estabelecimento / Contato</th>
                    <th className="py-3 px-3">Segmento</th>
                    <th className="py-3 px-3">Contato Rápido</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Estágio do Funil</th>
                    <th className="py-3 px-3">Próx. Follow-up</th>
                    <th className="py-3 px-3">Anotações</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingLeads ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
                        Carregando base de clientes do CRM...
                      </td>
                    </tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        Nenhum prospect encontrado. Clique em <b>+ Novo Lead</b> para começar sua prospecção!
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map(lead => {
                      const stageInfo = STAGES_CONFIG[lead.stage] || STAGES_CONFIG.novo;
                      return (
                        <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm">{lead.business_name}</div>
                            <div className="text-[11px] text-zinc-400">
                              {lead.contact_name ? `Resp: ${lead.contact_name}` : 'Sem contato cadastrado'}
                            </div>
                            {lead.demo_url && (
                              <a
                                href={lead.demo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline mt-0.5"
                              >
                                <Sparkles className="w-3 h-3" />
                                Ver Demo Gerada
                              </a>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.05] border border-white/10 text-zinc-300">
                              {lead.business_type}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              {lead.whatsapp && (
                                <button
                                  onClick={() => openWhatsApp(lead.whatsapp, 'Oi, [Nome]! Vi seu trabalho no Instagram e achei incrível. Você tem 1 minuto?')}
                                  title="Abrir WhatsApp"
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {lead.instagram && (
                                <a
                                  href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Ver Instagram"
                                  className="p-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 transition-all"
                                >
                                  <InstagramIcon className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {!lead.whatsapp && !lead.instagram && (
                                <span className="text-zinc-500 text-[11px]">—</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              lead.score >= 8 ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' :
                              lead.score >= 4 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30' :
                              'text-zinc-400 bg-zinc-800'
                            }`}>
                              {lead.score} pts
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <select
                              value={lead.stage}
                              onChange={e => handleUpdateStage(lead.id, e.target.value)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer ${stageInfo.bg} ${stageInfo.color} ${stageInfo.border}`}
                            >
                              {Object.entries(STAGES_CONFIG).map(([k, v]) => (
                                <option key={k} value={k} className="bg-[#13131A] text-white">
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3.5 px-3">
                            <input
                              type="date"
                              defaultValue={lead.next_follow_up || ''}
                              onBlur={e => handleUpdateFollowUp(lead.id, e.target.value)}
                              className="bg-[#13131A] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-emerald-500"
                            />
                          </td>

                          <td className="py-3.5 px-3 max-w-[200px]">
                            <p className="text-[11px] text-zinc-400 truncate" title={lead.notes || 'Sem anotações'}>
                              {lead.notes || '—'}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteLead(lead.id, lead.business_name)}
                              title="Excluir Lead"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: PLAYBOOK - 8 ETAPAS DO PROCESSO */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'playbook' && (
        <div className="space-y-6">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-400" />
              O Ciclo de Venda Direta (Sem Anúncios)
            </h3>
            <p className="text-zinc-400 text-sm mt-1 max-w-3xl">
              Este método foi estruturado para fechar os primeiros 10 a 50 clientes de forma orgânica.
              A regra de ouro: <b>nunca tente vender na primeira mensagem</b>. Venda a curiosidade de ver a própria página dela pronta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROCESS_MAP_STAGES.map((step, idx) => (
              <div key={idx} className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{step.ico}</span>
                    <div>
                      <h4 className="font-bold text-white text-base">{step.title}</h4>
                      <p className="text-emerald-400 text-xs font-medium">{step.objective}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 text-xs text-zinc-300">
                    <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">O que fazer:</div>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-300">
                      {step.whatToDo.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-[#13131A] border border-white/5">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Roteiro Sugerido:</div>
                    <p className="text-xs text-zinc-200 italic">"{step.script}"</p>
                    {step.script.includes('[') && (
                      <button
                        onClick={() => copyToClipboard(step.script)}
                        className="mt-2 text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" /> Copiar Mensagem
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-[11px] text-rose-400/90">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span><b>Evite:</b> {step.avoid}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: ÁRVORE DE DECISÃO INTERATIVA */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'arvore' && (
        <div className="space-y-4">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-emerald-400" />
                  Simulador de Navegação Comercial
                </h3>
                <p className="text-zinc-400 text-xs mt-0.5">
                  Escolha o que a profissional respondeu e veja exatamente a réplica testada para contornar e avançar.
                </p>
              </div>

              {treeNodeKey !== 'root' && (
                <button
                  onClick={() => setTreeNodeKey('root')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
                >
                  Reiniciar Árvore
                </button>
              )}
            </div>

            {/* Current Node Box */}
            {(() => {
              const node = DECISION_TREE_NODES[treeNodeKey] || DECISION_TREE_NODES.root;
              return (
                <div className="mt-6 space-y-4">
                  <div className="p-4 rounded-xl bg-[#13131A] border border-emerald-500/30">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Cenário Selecionado
                    </span>
                    <h4 className="text-base font-bold text-white mt-1.5">{node.title}</h4>
                    <p className="text-xs text-zinc-300 mt-1">🎯 <b>Objetivo:</b> {node.goal}</p>

                    {node.tips && node.tips.length > 0 && (
                      <ul className="list-disc pl-4 mt-2 space-y-0.5 text-xs text-zinc-400">
                        {node.tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    )}

                    {node.msg && (
                      <div className="mt-3 p-3 rounded-lg bg-[#0E0E14] border border-white/10">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                          Sua Resposta:
                        </div>
                        <p className="text-xs text-emerald-300 font-mono italic">"{node.msg}"</p>
                        <button
                          onClick={() => copyToClipboard(node.msg)}
                          className="mt-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar Resposta
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      O que ela respondeu a seguir?
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {node.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => setTreeNodeKey(opt.to)}
                          className="p-3 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-left text-xs font-semibold text-zinc-200 hover:text-emerald-300 transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <span>{opt.label}</span>
                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: BIBLIOTECA DE SCRIPTS DINÂMICOS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'scripts' && (
        <div className="space-y-6">
          {/* Dynamic Fillers */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Preencha para Personalizar Todas as Mensagens Automaticamente:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  placeholder="Ex: Amanda"
                  value={scriptTags.nome}
                  onChange={e => setScriptTags({ ...scriptTags, nome: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#13131A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Nome do Negócio</label>
                <input
                  type="text"
                  placeholder="Ex: Studio Bella"
                  value={scriptTags.negocio}
                  onChange={e => setScriptTags({ ...scriptTags, negocio: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#13131A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Bairro / Região</label>
                <input
                  type="text"
                  placeholder="Ex: Jardins"
                  value={scriptTags.bairro}
                  onChange={e => setScriptTags({ ...scriptTags, bairro: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#13131A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Link da Demo</label>
                <input
                  type="text"
                  placeholder="Ex: navalha.app/studiobella"
                  value={scriptTags.link}
                  onChange={e => setScriptTags({ ...scriptTags, link: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#13131A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Seu Nome</label>
                <input
                  type="text"
                  placeholder="Ex: Felipe"
                  value={scriptTags.seu_nome}
                  onChange={e => setScriptTags({ ...scriptTags, seu_nome: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#13131A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Scripts List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: 'Abordagem Manicure / Esmalteria',
                category: 'Primeiro Contato',
                text: 'Oi, [Nome]! Vi seu trabalho no Instagram, ficou maravilhoso o [detalhe real de um post]. Uma curiosidade rápida: quando uma cliente nova quer marcar com você, ela te chama no direct/WhatsApp e você responde na mão, ou ela já consegue escolher o horário sozinha?',
                reason: 'Elogio autêntico desfaz a guarda defensiva; a pergunta foca na rotina sem empurrar produto.'
              },
              {
                title: 'Abordagem Barbearia',
                category: 'Primeiro Contato',
                text: 'Fala, [Nome]! Passei no perfil da [Negócio], os cortes estão muito diferenciados. Uma pergunta: vocês marcam tudo no WhatsApp ou já usam alguma agenda online com link na bio? Pergunto porque montei um sistema que bloqueia furo de cliente e queria te mostrar como ficaria.',
                reason: 'Barbearias sentem a dor de faltas diárias e agendamento de última hora.'
              },
              {
                title: 'Follow-up 24h (Sem Pressão)',
                category: 'Follow-up',
                text: 'Oi, [Nome]! Sei que a rotina de atendimentos é corrida. Montei aqui como ficaria uma página com os seus serviços só pra você olhar no celular quando puder: [Link]. Se não fizer sentido, me avisa que eu paro por aqui 🙂',
                reason: 'Oferece valor palpável (página pronta) e dá uma saída elegante que reduz a sensação de spam.'
              },
              {
                title: 'Follow-up 48h (Pergunta Sim/Não)',
                category: 'Follow-up',
                text: 'Imagino que a semana esteja cheia aí! Só uma pergunta bem rápida: pra você faz sentido ter agendamento online automático ou hoje o WhatsApp atende 100% da sua rotina? Qualquer resposta me ajuda!',
                reason: 'Pergunta binária e simples de responder, tirando o peso da recusa.'
              },
              {
                title: 'Despedida Respeitosa (Último Contato)',
                category: 'Encerramento',
                text: 'Vou encerrar por aqui pra não incomodar seu trabalho. Deixo aqui o link de exemplo: [Link]. Se a agenda um dia virar dor de cabeça por aí, é só me chamar. Sucesso nos atendimentos! ✨',
                reason: 'Gera reciprocidade e frequentemente recupera clientes semanas depois.'
              },
              {
                title: 'Fechamento do Teste 7 Dias',
                category: 'Fechamento',
                text: 'Perfeito! Vamos fazer o seguinte: me manda uma foto da sua tabela de serviços com preços e o horário que você atende. Eu deixo tudo configurado pra você hoje e você testa 7 dias na prática com clientes reais. Depois você decide se quer continuar.',
                reason: 'Elimina todo o esforço de configuração dela ("eu configuro para você").'
              }
            ].map((sc, idx) => (
              <div key={idx} className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      {sc.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm mb-3">{sc.title}</h4>

                  <div className="p-3.5 rounded-xl bg-[#13131A] border border-white/10 font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {sc.text
                      .split('[Nome]').join(scriptTags.nome || '[Nome]')
                      .split('[Negócio]').join(scriptTags.negocio || '[Negócio]')
                      .split('[Bairro]').join(scriptTags.bairro || '[Bairro]')
                      .split('[Link]').join(scriptTags.link || '[Link]')
                      .split('[Seu nome]').join(scriptTags.seu_nome || '[Seu nome]')}
                  </div>

                  <p className="text-[11px] text-zinc-500 mt-2">
                    <b>Por que funciona:</b> {sc.reason}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(sc.text)}
                    className="flex-1 py-2 rounded-xl bg-white/[0.05] hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-white/10 text-zinc-200 hover:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar Mensagem
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: MANUAL DE OBJEÇÕES */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'objecoes' && (
        <div className="space-y-4">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar objeção (ex: caro, whatsapp, tecnologia, cliente, pensar)..."
                value={objectionSearch}
                onChange={e => setObjectionSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#13131A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {OBJECTIONS_LIBRARY
              .filter(o => !objectionSearch || o.q.toLowerCase().includes(objectionSearch.toLowerCase()) || o.script.toLowerCase().includes(objectionSearch.toLowerCase()))
              .map((obj, i) => (
                <div key={i} className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="font-bold text-white text-sm">{obj.q}</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">🧠 O que ela pensa:</span>
                      <p className="text-zinc-300 mt-1">{obj.mindset}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-500/[0.04] border border-rose-500/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">🚫 O que NUNCA responder:</span>
                      <p className="text-rose-200 mt-1">{obj.neverSay}</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#13131A] border border-emerald-500/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">💬 Como Responder (Script Pronto):</span>
                    <p className="text-xs text-zinc-100 font-mono mt-1 italic leading-relaxed">"{obj.script}"</p>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5">
                      <span className="text-[11px] text-zinc-400"><b>Próximo Passo:</b> {obj.nextStep}</span>
                      <button
                        onClick={() => copyToClipboard(obj.script)}
                        className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: CALCULADORA DE SCORE DE LEADS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'score' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-400" />
                Auditoria de Qualificação de Perfil (Instagram / Maps)
              </h3>
              <p className="text-zinc-400 text-xs mt-1">
                Marque os sinais que encontrou no perfil antes de iniciar a abordagem para priorizar os contatos com maior chance de conversão.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {SCORE_QUESTIONS.map((q, idx) => (
                <label
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    scoreChecked[idx]
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                      : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!scoreChecked[idx]}
                      onChange={() => setScoreChecked({ ...scoreChecked, [idx]: !scoreChecked[idx] })}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-[#13131A] border-white/20"
                    />
                    <span className="text-xs">{q.text}</span>
                  </div>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                    q.points > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {q.points > 0 ? `+${q.points}` : q.points} pts
                  </span>
                </label>
              ))}
            </div>

            <button
              onClick={() => setScoreChecked({})}
              className="text-xs text-zinc-500 hover:text-white underline cursor-pointer"
            >
              Zerar Seleção
            </button>
          </div>

          {/* Result Card */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="text-center pb-4 border-b border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Pontuação do Lead</span>
                <div className="text-5xl font-black text-white mt-1 font-mono">{calculatedScore}</div>
                <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold border ${scoreBadge.color}`}>
                  {scoreBadge.text}
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-zinc-400">
                <p><b>Faixas de Corte:</b></p>
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <b>9+ pontos:</b> Abordar hoje com prioridade máxima.
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <b>5 a 8 pontos:</b> Boa oportunidade para a fila ativa.
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <b>Abaixo de 5:</b> Fila fria (só se faltar lead).
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setNewLead(prev => ({ ...prev, score: calculatedScore }));
                setIsModalOpen(true);
              }}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Salvar Este Lead no CRM
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 7: ROTINA DIÁRIA & CHECKLIST */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-400" />
              Checklist Operacional Diário (3h30 por dia)
            </h3>
            <p className="text-zinc-400 text-xs mt-1">
              A consistência vence o talento. Cumpra estas tarefas diárias para gerar um fluxo previsível de 15 a 30 novos contatos por semana.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                time: '30 min',
                title: '1. Mineração de Leads',
                tasks: [
                  'Abrir Google Maps e Instagram (#esmalteria, #barbearia, etc)',
                  'Listar 20 a 25 novos estabelecimentos',
                  'Calcular o Score de cada um e ordenar por prioridade'
                ]
              },
              {
                time: '60 min',
                title: '2. Envio de Primeiros Contatos',
                tasks: [
                  'Olhar 3 posts/stories de cada lead antes de escrever',
                  'Enviar 15 mensagens personalizadas citando detalhe real',
                  'Cadastrar cada contato com data no CRM'
                ]
              },
              {
                time: '45 min',
                title: '3. Respostas & Qualificação',
                tasks: [
                  'Responder todas as mensagens recebidas em até 1 hora',
                  'Descobrir se ela tem dor com faltas e tempo no WhatsApp',
                  'Perguntar quantas faltas ocorrem por semana'
                ]
              },
              {
                time: '30 min',
                title: '4. Follow-ups do Funil',
                tasks: [
                  'Mandar follow-up de 24h para quem não respondeu ontem',
                  'Mandar follow-up de 48h para quem visualizou',
                  'Encerrar educadamente contatos frios há mais de 3 dias'
                ]
              },
              {
                time: '30 min',
                title: '5. Criação de Demos & Onboarding',
                tasks: [
                  'Criar 1 a 3 Portais Demo para quem aceitou ver',
                  'Ajudar a cadastrar serviços de quem fechou',
                  'Checar salões que estão no período de 7 dias de teste'
                ]
              },
              {
                time: '15 min',
                title: '6. Fechamento & Revisão',
                tasks: [
                  'Atualizar os estágios de todos os leads no CRM',
                  'Anotar qual foi a maior objeção do dia',
                  'Definir as 3 prioridades do dia seguinte'
                ]
              }
            ].map((block, bIdx) => (
              <div key={bIdx} className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    ⏱️ {block.time}
                  </span>
                </div>
                <h4 className="font-bold text-white text-sm mb-3">{block.title}</h4>
                <div className="space-y-2">
                  {block.tasks.map((task, tIdx) => {
                    const globalIdx = bIdx * 10 + tIdx;
                    const done = !!dailyTasks[globalIdx];
                    return (
                      <label
                        key={tIdx}
                        className={`flex items-start gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          done ? 'bg-emerald-500/10 text-zinc-400 line-through' : 'hover:bg-white/[0.04] text-zinc-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => setDailyTasks({ ...dailyTasks, [globalIdx]: !done })}
                          className="w-3.5 h-3.5 mt-0.5 rounded text-emerald-500 bg-[#13131A] border-white/20"
                        />
                        <span>{task}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 8: CONVERSAS SIMULADAS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'simulacoes' && (
        <div className="space-y-6">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Treinamento de Conversas Simuladas
            </h3>
            <p className="text-zinc-400 text-xs mt-1">
              Observe o fluxo de mensagens reais e preste atenção nas caixas de coaching comercial que explicam o porquê de cada resposta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Simulation 1 */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 shadow-xl space-y-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Exemplo 1: Manicure Autônoma (Caminho Feliz)
              </span>

              <div className="p-4 rounded-xl bg-[#090C0A] border border-white/10 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-100 max-w-[85%] ml-auto border border-emerald-500/30">
                  Oi, Jéssica! Vi seu trabalho no Instagram, ficou lindo o nail art de flores do último post. Uma curiosidade: quando uma cliente quer marcar, ela chama no direct e você responde na mão, ou já escolhe sozinha?
                </div>

                <div className="p-3 rounded-xl bg-white/[0.05] text-zinc-300 max-w-[85%] border border-white/5">
                  Oi! Obrigada 😍 chama no direct mesmo, eu respondo quando consigo entre um atendimento e outro.
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                  💡 <b>Coaching:</b> Ela respondeu ao elogio sincero. Agora aprofunde a dor sem enviar link nem falar de preço!
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-100 max-w-[85%] ml-auto border border-emerald-500/30">
                  Imagino que quando você tá com cliente fica difícil parar pra responder né. Já aconteceu de perder cliente nova porque demorou a responder? Ou de cliente furar horário?
                </div>

                <div className="p-3 rounded-xl bg-white/[0.05] text-zinc-300 max-w-[85%] border border-white/5">
                  Nossa, direto! Às vezes a pessoa nem espera e ainda tem as que marcam e somem sem avisar 😕
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                  💡 <b>Coaching:</b> Dor quantificada pela própria cliente. Agora proponha ver a demonstração personalizada!
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-100 max-w-[85%] ml-auto border border-emerald-500/30">
                  O que montei resolve exatamente isso: um link na sua bio, a cliente escolhe o serviço e o horário sozinha, só aparecem horários livres e já reserva. Quer ver como ficaria com o seu nome? Eu monto e te mando em 5 minutos!
                </div>

                <div className="p-3 rounded-xl bg-white/[0.05] text-zinc-300 max-w-[85%] border border-white/5">
                  Quero sim, pode mandar!
                </div>
              </div>
            </div>

            {/* Simulation 2 */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 shadow-xl space-y-3">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Exemplo 2: Barbearia (Pediu Preço Logo no Início)
              </span>

              <div className="p-4 rounded-xl bg-[#090C0A] border border-white/10 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-100 max-w-[85%] ml-auto border border-emerald-500/30">
                  Fala, Marcos! Passei no perfil da barbearia, os cortes tão muito alinhados. Vocês marcam tudo no WhatsApp ou já têm sistema de agendamento online?
                </div>

                <div className="p-3 rounded-xl bg-white/[0.05] text-zinc-300 max-w-[85%] border border-white/5">
                  Quanto custa esse sistema aí?
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                  💡 <b>Coaching:</b> Pediu preço: responda direto e sem enrolação, ancorando contra o corte dele!
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-100 max-w-[85%] ml-auto border border-emerald-500/30">
                  Pra barbearia com equipe o plano sai R$ 77/mês (se atende sozinho, apenas R$ 27) e tem 7 dias de teste grátis. Pra ter ideia: é menos que 1 corte por mês! Antes de decidir qualquer coisa: posso te mandar uma página de exemplo com o nome da barbearia?
                </div>

                <div className="p-3 rounded-xl bg-white/[0.05] text-zinc-300 max-w-[85%] border border-white/5">
                  Manda aí pra eu ver como é.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: NOVO LEAD NO CRM */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Novo Lead no CRM
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              Cadastre o salão ou profissional para acompanhamento e controle do funil comercial.
            </p>

            <form onSubmit={handleSaveNewLead} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Nome do Estabelecimento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Studio Bella Donna"
                  value={newLead.business_name}
                  onChange={e => setNewLead({ ...newLead, business_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#13131A] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Nome do Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: Camila"
                    value={newLead.contact_name}
                    onChange={e => setNewLead({ ...newLead, contact_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Tipo de Negócio</label>
                  <select
                    value={newLead.business_type}
                    onChange={e => setNewLead({ ...newLead, business_type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="barbearia">Barbearia</option>
                    <option value="salao">Salão de Beleza</option>
                    <option value="esmalteria">Esmalteria / Manicure</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 99999-9999"
                    value={newLead.whatsapp}
                    onChange={e => setNewLead({ ...newLead, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Instagram (@)</label>
                  <input
                    type="text"
                    placeholder="Ex: @studiobella"
                    value={newLead.instagram}
                    onChange={e => setNewLead({ ...newLead, instagram: e.target.value })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Canal de Origem</label>
                  <select
                    value={newLead.channel}
                    onChange={e => setNewLead({ ...newLead, channel: e.target.value })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Google Maps">Google Maps</option>
                    <option value="Presencial">Presencial (Visita)</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Estágio Inicial</label>
                  <select
                    value={newLead.stage}
                    onChange={e => setNewLead({ ...newLead, stage: e.target.value })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {Object.entries(STAGES_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Score de Lead (0 a 10)</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={newLead.score}
                    onChange={e => setNewLead({ ...newLead, score: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Próximo Follow-up</label>
                  <input
                    type="date"
                    value={newLead.next_follow_up}
                    onChange={e => setNewLead({ ...newLead, next_follow_up: e.target.value })}
                    className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Link do Portal Demo Gerado</label>
                <input
                  type="text"
                  placeholder="Ex: https://navalha.app/paginas/studiobella"
                  value={newLead.demo_url}
                  onChange={e => setNewLead({ ...newLead, demo_url: e.target.value })}
                  className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Anotações / Observações</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Falou que tem 3 faltas por semana. Prefere falar de tarde."
                  value={newLead.notes}
                  onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {savingLead ? 'Salvando...' : 'Salvar no CRM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
