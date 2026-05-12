import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config()

import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'

const SLUG = 'style_guide_text'
const TITLE = 'Стиль-гайд: текстовые посты'
const PLACEHOLDER = `# Стиль-гайд для текстовых постов

## Тон голоса

- Уверенный, познавательный, без морализаторства.
- Простые предложения. Минимум канцелярита.
- Эмоция > сухие факты, но факты — точные.

## Структура

- Хук: цепляющая первая строка (вопрос / парадокс / неожиданный факт).
- Основа: 1-2 факта или мысль с примером.
- Закрытие: мысль или мягкий CTA (без «купи»).

## Лексика

- Не используем: «делимся», «рады представить», «обращаем ваше внимание».
- Используем: бытовые слова, точные термины там, где нужны термины.

## Длина

- Telegram / VK / X: 400-800 символов.

## TODO

Этот документ — placeholder. Оператор: расширь через /marketing/strategy →
сохрани полный гайд в brand_docs.style_guide_text.
`

async function main() {
  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(BrandDoc)
  const existing = await repo.findOne({ where: { slug: SLUG } })
  if (existing) {
    console.log(`brand_docs.${SLUG} уже существует — пропускаю`)
    await AppDataSource.destroy()
    return
  }
  await repo.save(
    repo.create({
      slug: SLUG,
      title: TITLE,
      content: PLACEHOLDER,
      version: '1.0-placeholder',
    }),
  )
  console.log(`brand_docs.${SLUG} создан`)
  await AppDataSource.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
