import { TRANSLATIONS } from './translations';

type Language = 'en' | 'ru';
// Only known system messages are matched. Addresses, amounts and user text remain intact.
const templates: [RegExp, (m: RegExpMatchArray, language: Language) => string][] = [
 [/^(coupon|voting|redemption|partialRedemption) #(.+)$/, (m,l) => `${TRANSLATIONS[m[1]][l]} #${m[2]}`],
 [/^Instrument #(.+)$/, (m,l) => `${l==='ru'?'Выпуск №':'Instrument #'}${m[1]}`],
 [/^Finalized program right (\S+) · slot (\d+)$/, (m,l) => l==='ru'?`Финализированное право ${m[1]} · слот ${m[2]}`:m[0]],
 [/^Verification unavailable: ([\s\S]+)$/, (m,l) => `${l==='ru'?'Проверка недоступна':'Verification unavailable'}: ${translate(m[1],l)}`],
 [/^Failed transaction (\S+); finalized rights still control retries\.$/, (m,l) => l==='ru'?`Неуспешная транзакция ${m[1]}; повторное исполнение определяется финализированными правами.`:m[0]],
 [/^Transaction (\S+) awaits finalized confirmation\.$/, (m,l) => l==='ru'?`Транзакция ${m[1]} ожидает финализированного подтверждения.`:m[0]],
 [/^Finalized transaction (\S+) needs matching processed program right\.$/, (m,l) => l==='ru'?`Финализированная транзакция ${m[1]} требует соответствующего исполненного права программы.`:m[0]],
 [/^Local Solana RPC unavailable \(([^)]+)\)\. Start or resume your local validator, then retry loading\. Your wallet connection is preserved\.$/, (m,l) => l==='ru'?`Локальный Solana RPC недоступен (${m[1]}). Запустите или возобновите локальный валидатор и повторите загрузку. Подключение кошелька сохранено.`:m[0]],
];

export function translate(text: string, language: Language): string {
 const message=TRANSLATIONS[text];
 if(message)return message[language];
 for(const [pattern,render] of templates){const match=text.match(pattern);if(match)return render(match,language);}
 return text;
}
