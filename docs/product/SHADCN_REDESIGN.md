# OrgTrace — адаптация визуального стиля shadcn-admin

Дата: 23.09.2026. Ветка `lane/frontend-ux`, база `1638fff`.

## Направление

Референс пользователя: [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), просмотрен commit `e16c87f`. Перенесены принципы оформления: нейтральная светлая палитра, sidebar, компактная шапка, тёмное основное действие, метрики, сегментированная навигация, тонкие границы, таблицы и боковая панель проверки.

Реализация использует текущие Next.js/React-компоненты и CSS. Vite, TanStack Router, Clerk, Tailwind и Radix из референса не добавлялись. Это адаптация дизайна, не установка полного shadcn-admin. Backend, API routes, shared contract, mock, package.json и lockfile не изменены.

## Реализовано

- Sidebar с работающими переходами и сворачиванием. Раздел текущего анализа хранится в URL `view`.
- Главный экран результатов — таблица замечаний с поиском по тексту и владельцу, фильтрами по типу/решению/основанию, сортировкой по серверному reviewPriority, страницами по 12 записей.
- Четыре раздельные метрики: все замечания; серверные подтверждённые основания; диагностические кандидаты; решения CONFIRMED/REJECTED. NEEDS_CHECK не считается завершённым решением.
- Предупреждения доступны в раскрываемом блоке. Наличие ограничений видно постоянно. DEMO / MOCK DATA сохраняется.
- Документы/структура/функции/заключение показываются самостоятельными разделами. Список замечаний больше не помещается под 30 полными парами пунктов.
- По умолчанию в документном сравнении скрыты unchanged и cosmetic; доступны отдельные переключатели. Серверные общие счётчики не меняются.
- Источники подняты выше дополнительных сведений. Панель review закреплена снизу, доступны предыдущая/следующая находки в текущей выборке.
- Черновик комментария сохраняется при закрытии drawer до перезагрузки страницы. Во время PATCH закрытие, Escape и смена находки заблокированы до ответа; есть состояния сохранения/успеха/ошибки.
- Убраны повторения локаторов. Для документных дефектов без unit/function IDs не выводятся пустые разделы.
- Заключение сохраняет текст сервера, длинные списки связанных замечаний раскрываются по запросу.
- Обновлены загрузка и этапы; локально проверяются пустые/неподдерживаемые/слишком большие файлы, одинаковые имена на стороне, суммарные лимиты. Multipart overhead окончательно проверяет API.
- Пустые фильтры имеют пояснение. Поиск структуры и функций хранится отдельно.

## Проверка

Проверка в браузере на настоящем локальном API с `ORGTRACE_AI=false`, `NEXT_PUBLIC_USE_MOCK=false`. Это не проверка качества live AI.

- Основная TXT-пара успешно повторно загружена через новый интерфейс. ID `b64bbc59-7fa0-4d7b-9be4-ab66b4a7a621`; 87 замечаний, 70 verified, 17 diagnostic.
- Карточка кандидатов → 17 записей; поиск 5.6.2 → 1 запись; drawer открывается.
- Черновик переживает закрытие/повторное открытие; PATCH показывает «Решение сохранено»; reload восстанавливает комментарий (проверено на первоначальном локальном ID `fa7683d3-84db-4992-9654-b4cf30ec0e1d`).
- Сравнение по умолчанию → 108 записей; включение unchanged и cosmetic → 488.
- Переданные функции → 19 строк (плюс заголовок таблицы). Заключение отображает шесть секций.
- Поиск структуры без совпадений показывает объяснение.
- Проверены 1280×720 и 1024×768; наружного горизонтального переполнения не обнаружено, широкая таблица прокручивается внутри контейнера. Полная проверка мобильных/assistive technologies — NOT RUN.
- Все browser console errors/warnings и финальные команды проверяются перед передачей; результаты записаны в пользовательском отчёте.

## Ограничения

Фильтры и черновики сохраняются при переходах между разделами, но не после полной перезагрузки; в URL хранится раздел, сервер хранит отправленные решения. Нельзя обещать сохранность несохранённого текста после закрытия вкладки. Полная серверная история, OCR, загрузка оригиналов для скачивания и новая AI-логика не добавлены.

## Атрибуция референса

Оригинальный проект опубликован по MIT. Уведомление сохранено здесь для адаптированных принципов оформления:

MIT License

Copyright (c) 2024 Sat Naing

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
