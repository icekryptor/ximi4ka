import { AppDataSource } from '../config/database';
import { Category } from '../entities/Category';
import { Counterparty } from '../entities/Counterparty';
import { TransactionType } from '../entities/Transaction';
import { CounterpartyType } from '../entities/Counterparty';

async function seedDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const categoryRepository = AppDataSource.getRepository(Category);
    const counterpartyRepository = AppDataSource.getRepository(Counterparty);

    // Проверяем, есть ли уже данные
    const existingCategories = await categoryRepository.count();
    if (existingCategories > 0) {
      console.log('⚠️  База данных уже содержит данные. Пропускаем инициализацию.');
      await AppDataSource.destroy();
      return;
    }

    console.log('📝 Создание начальных категорий...');

    // Категории доходов
    const incomeCategories = [
      { name: 'Продажа наборов', type: TransactionType.INCOME, color: '#10b981', description: 'Продажа химических наборов' },
      { name: 'Оптовые продажи', type: TransactionType.INCOME, color: '#0ea5e9', description: 'Оптовые продажи партнерам' },
      { name: 'Онлайн продажи', type: TransactionType.INCOME, color: '#8b5cf6', description: 'Продажи через интернет-магазин' },
      { name: 'Розничные продажи', type: TransactionType.INCOME, color: '#14b8a6', description: 'Розничные продажи в магазине' },
      { name: 'Прочие доходы', type: TransactionType.INCOME, color: '#f59e0b', description: 'Другие источники дохода' },
    ];

    // Категории расходов
    const expenseCategories = [
      { name: 'Закупка сырья', type: TransactionType.EXPENSE, color: '#ef4444', description: 'Закупка химических реагентов и материалов' },
      { name: 'Упаковка', type: TransactionType.EXPENSE, color: '#f97316', description: 'Закупка упаковочных материалов' },
      { name: 'Аренда', type: TransactionType.EXPENSE, color: '#ec4899', description: 'Аренда помещения' },
      { name: 'Зарплата', type: TransactionType.EXPENSE, color: '#8b5cf6', description: 'Заработная плата сотрудников' },
      { name: 'Реклама', type: TransactionType.EXPENSE, color: '#0ea5e9', description: 'Расходы на рекламу и маркетинг' },
      { name: 'Доставка', type: TransactionType.EXPENSE, color: '#14b8a6', description: 'Расходы на доставку' },
      { name: 'Коммунальные услуги', type: TransactionType.EXPENSE, color: '#f59e0b', description: 'Электричество, вода, отопление' },
      { name: 'Прочие расходы', type: TransactionType.EXPENSE, color: '#6b7280', description: 'Другие операционные расходы' },
    ];

    const allCategories = [...incomeCategories, ...expenseCategories];
    for (const categoryData of allCategories) {
      const category = categoryRepository.create(categoryData);
      await categoryRepository.save(category);
    }

    console.log(`✅ Создано ${allCategories.length} категорий`);

    console.log('📝 Создание примеров контрагентов...');

    // Примеры контрагентов
    const counterparties = [
      {
        name: 'ООО "ХимСнаб"',
        type: CounterpartyType.SUPPLIER,
        inn: '7701234567',
        address: 'г. Москва, ул. Химическая, д. 10',
        phone: '+7 (495) 123-45-67',
        email: 'info@himsnab.ru',
        contact_person: 'Иванов Иван Иванович',
        notes: 'Основной поставщик химических реагентов'
      },
      {
        name: 'ИП Петров П.П.',
        type: CounterpartyType.CUSTOMER,
        inn: '771234567890',
        phone: '+7 (926) 123-45-67',
        email: 'petrov@example.com',
        contact_person: 'Петров Петр Петрович',
        notes: 'Постоянный оптовый покупатель'
      },
      {
        name: 'Детский мир',
        type: CounterpartyType.CUSTOMER,
        inn: '7712345678',
        address: 'г. Москва, ТЦ Афимолл',
        phone: '+7 (495) 987-65-43',
        email: 'partnership@detmir.ru',
        contact_person: 'Сидорова Анна Сергеевна',
        notes: 'Крупная розничная сеть'
      },
      {
        name: 'ООО "ПакМатериалы"',
        type: CounterpartyType.SUPPLIER,
        inn: '7723456789',
        address: 'г. Москва, Промзона',
        phone: '+7 (495) 555-12-34',
        email: 'sales@pakmaterials.ru',
        contact_person: 'Козлов Дмитрий Владимирович',
        notes: 'Поставщик упаковки'
      }
    ];

    for (const counterpartyData of counterparties) {
      const counterparty = counterpartyRepository.create(counterpartyData);
      await counterpartyRepository.save(counterparty);
    }

    console.log(`✅ Создано ${counterparties.length} контрагентов`);

    console.log('🎉 Инициализация завершена успешно!');
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    process.exit(1);
  }
}

seedDatabase();
