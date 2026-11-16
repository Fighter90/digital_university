// DIG-46 — синоним пути из задачи: «полный экран /assistant». Канонический
// путь раздела — /ai-assistant (глубокие ссылки DIG-28, меню, топбар и
// каталог сервисов уже ссылаются туда), поэтому /assistant отвечает
// 307-редиректом на него.
import { redirect } from 'next/navigation';

export default function AssistantRedirectPage(): never {
  redirect('/ai-assistant');
}
