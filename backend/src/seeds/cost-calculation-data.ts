import { AppDataSource } from '../config/database';
import { Component, ComponentCategory } from '../entities/Component';
import { Kit } from '../entities/Kit';
import { KitComponent } from '../entities/KitComponent';

async function seedCostData() {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const componentRepository = AppDataSource.getRepository(Component);
    const kitRepository = AppDataSource.getRepository(Kit);
    const kitComponentRepository = AppDataSource.getRepository(KitComponent);

    // Проверяем, есть ли уже данные
    const existingComponents = await componentRepository.count({ where: { category: ComponentCategory.REAGENT } });
    if (existingComponents > 0) {
      console.log('⚠️  Данные расчета себестоимости уже существуют.');
      await AppDataSource.destroy();
      return;
    }

    console.log('📝 Создание компонентов для расчета себестоимости...');

    // Реактивы
    const reagents = [
      { name: 'AgNO3', purchase_cost: 199000, batch_weight: 1000, per_kit_amount: 0.21, price_per_gram: 199, price_per_kit: 41.79 },
      { name: 'Al2SO4', purchase_cost: 121, batch_weight: 1000, per_kit_amount: 3.4, price_per_gram: 0.12, price_per_kit: 0.41 },
      { name: 'BaCl2', purchase_cost: 3800, batch_weight: 1000, per_kit_amount: 1.23, price_per_gram: 3.80, price_per_kit: 4.67 },
      { name: 'CoSO4', purchase_cost: 1100, batch_weight: 1000, per_kit_amount: 3.17, price_per_gram: 1.10, price_per_kit: 3.49 },
      { name: 'CuSO4', purchase_cost: 667, batch_weight: 1000, per_kit_amount: 2.73, price_per_gram: 0.67, price_per_kit: 1.82 },
      { name: 'FeSO4', purchase_cost: 456, batch_weight: 1000, per_kit_amount: 3.2, price_per_gram: 0.46, price_per_kit: 1.46 },
      { name: 'H2SO4', purchase_cost: 300, batch_weight: 1000, per_kit_amount: 3.47, price_per_gram: 0.30, price_per_kit: 1.04 },
      { name: '(NH4)2CO3', purchase_cost: 2258, batch_weight: 5000, per_kit_amount: 1.75, price_per_gram: 0.45, price_per_kit: 0.79 },
      { name: 'спирт изопропиловый', purchase_cost: 35000, batch_weight: 220000, per_kit_amount: 20, price_per_gram: 0.16, price_per_kit: 3.18 },
      { name: 'Фенолфталеин', purchase_cost: 5000, batch_weight: 1000, per_kit_amount: 0.14, price_per_gram: 5.00, price_per_kit: 0.70 },
      { name: 'K2Cr2O7', purchase_cost: 854, batch_weight: 1000, per_kit_amount: 1.05, price_per_gram: 0.85, price_per_kit: 0.90 },
      { name: 'KI', purchase_cost: 11000, batch_weight: 1000, per_kit_amount: 1.4, price_per_gram: 11.00, price_per_kit: 15.40 },
      { name: 'KMnO4', purchase_cost: 1400, batch_weight: 1000, per_kit_amount: 0.105, price_per_gram: 1.40, price_per_kit: 0.15 },
      { name: 'K3PO4', purchase_cost: 911, batch_weight: 1000, per_kit_amount: 2.79, price_per_gram: 0.91, price_per_kit: 2.54 },
      { name: 'NaOH', purchase_cost: 450, batch_weight: 5000, per_kit_amount: 4.55, price_per_gram: 0.09, price_per_kit: 0.41 },
      { name: 'Ni(NO3)2', purchase_cost: 420, batch_weight: 1000, per_kit_amount: 2.53, price_per_gram: 0.42, price_per_kit: 1.06 },
      { name: 'Цинк', purchase_cost: 1200, batch_weight: 1000, per_kit_amount: 2.5, price_per_gram: 1.20, price_per_kit: 3.00 },
      { name: 'Железо', purchase_cost: 243, batch_weight: 1000, per_kit_amount: 2.5, price_per_gram: 0.24, price_per_kit: 0.61 },
      { name: 'Сульфит натрия', purchase_cost: 148, batch_weight: 1000, per_kit_amount: 4, price_per_gram: 0.15, price_per_kit: 0.59 },
      { name: 'Дистиллированная вода', purchase_cost: 15000, batch_weight: 1000000, per_kit_amount: 300, price_per_gram: 0.015, price_per_kit: 4.50 },
    ];

    for (const reagent of reagents) {
      const component = componentRepository.create({
        ...reagent,
        category: ComponentCategory.REAGENT,
        unit_price: reagent.price_per_gram,
        quantity_per_kit: reagent.per_kit_amount,
        is_active: true
      });
      await componentRepository.save(component);
    }

    console.log(`✅ Создано ${reagents.length} реактивов`);

    // Комплектующие
    const equipment = [
      { name: 'Пипетки', unit_price: 0.79, quantity_per_kit: 3, price_per_kit: 2.38 },
      { name: 'Капсулы 2,5 г', unit_price: 1.28, quantity_per_kit: 2, price_per_kit: 2.57 },
      { name: 'Капсулы 4 г', unit_price: 1.53, quantity_per_kit: 1, price_per_kit: 1.53 },
      { name: 'Индикаторы флаконы', unit_price: 2.96, quantity_per_kit: 1, price_per_kit: 2.96 },
      { name: 'Большие флаконы', unit_price: 5.57, quantity_per_kit: 2, price_per_kit: 11.14 },
      { name: 'Маленькие флаконы (светлые)', unit_price: 4.73, quantity_per_kit: 11, price_per_kit: 51.98 },
      { name: 'Черные флаконы', unit_price: 4.91, quantity_per_kit: 1, price_per_kit: 4.91 },
      { name: 'Ложечки (Китай)', unit_price: 1.10, quantity_per_kit: 2, price_per_kit: 2.20 },
      { name: 'Зажимы', unit_price: 27.08, quantity_per_kit: 1, price_per_kit: 27.08 },
      { name: 'Свечи', unit_price: 6.16, quantity_per_kit: 1, price_per_kit: 6.16 },
      { name: 'ершик', unit_price: 7.51, quantity_per_kit: 1, price_per_kit: 7.51 },
      { name: 'штативы', unit_price: 31.19, quantity_per_kit: 1, price_per_kit: 31.19 },
      { name: 'Пробирки', unit_price: 5.19, quantity_per_kit: 6, price_per_kit: 31.14 },
      { name: 'Портативный разогреватель', unit_price: 17.91, quantity_per_kit: 1, price_per_kit: 17.91 },
      { name: 'Перчатки', unit_price: 4.35, quantity_per_kit: 1, price_per_kit: 4.35 },
    ];

    for (const item of equipment) {
      const component = componentRepository.create({
        ...item,
        category: ComponentCategory.EQUIPMENT,
        is_active: true
      });
      await componentRepository.save(component);
    }

    console.log(`✅ Создано ${equipment.length} комплектующих`);

    // Печатная продукция
    const printProducts = [
      { name: 'Коробка', unit_price: 212.20, quantity_per_kit: 1, price_per_kit: 212.20 },
      { name: 'Этикетки', unit_price: 0.97, quantity_per_kit: 15, price_per_kit: 15.19 },
      { name: 'Листовка', unit_price: 1.21, quantity_per_kit: 1, price_per_kit: 1.21 },
      { name: 'Листовка ФФ', unit_price: 3.99, quantity_per_kit: 1, price_per_kit: 3.99 },
      { name: 'Методичка', unit_price: 54.05, quantity_per_kit: 1, price_per_kit: 54.05 },
      { name: 'Защитная коробка', unit_price: 29.13, quantity_per_kit: 1, price_per_kit: 29.13 },
      { name: 'Короб 60х40', unit_price: 80.00, quantity_per_kit: 0.1, price_per_kit: 8.24 },
    ];

    for (const item of printProducts) {
      const component = componentRepository.create({
        ...item,
        category: ComponentCategory.PRINT,
        is_active: true
      });
      await componentRepository.save(component);
    }

    console.log(`✅ Создано ${printProducts.length} элементов печатной продукции`);

    // Работа
    const labor = [
      { name: 'Оплата за розлив', unit_price: 180, quantity_per_kit: 1, price_per_kit: 180 },
      { name: 'Оплата за сборку 1 химички', unit_price: 200, quantity_per_kit: 1, price_per_kit: 200 },
      { name: 'Аренда', unit_price: 131.10, quantity_per_kit: 1, price_per_kit: 131.10 },
    ];

    for (const item of labor) {
      const component = componentRepository.create({
        ...item,
        category: ComponentCategory.LABOR,
        is_active: true
      });
      await componentRepository.save(component);
    }

    console.log(`✅ Создано ${labor.length} позиций работы`);

    // Все компоненты для связки
    const allComponents = await componentRepository.find();

    // Создаем набор "Химичка" и связываем все компоненты
    const kitHim = kitRepository.create({
      name: 'Химичка',
      sku: 'CHEM-001',
      description: 'Химический набор для опытов',
      batch_size: 5000,
      reagents_cost: 84.01,
      equipment_cost: 205.01,
      print_cost: 324.02,
      labor_cost: 511.10,
      total_cost: 1124.14,
      is_active: true
    });
    const savedHim = await kitRepository.save(kitHim) as Kit;
    for (const comp of allComponents) {
      await kitComponentRepository.save(
        kitComponentRepository.create({ kit_id: savedHim.id, component_id: comp.id, quantity: comp.quantity_per_kit || 1 })
      );
    }
    console.log('✅ Создан набор "Химичка"');

    // Создаем набор "Электрохимичка" (пустой, заполняется вручную)
    const kitElectro = kitRepository.create({
      name: 'Электрохимичка',
      sku: 'ECHEM-001',
      description: 'Электрохимический набор для опытов',
      batch_size: 1000,
      reagents_cost: 0,
      equipment_cost: 0,
      print_cost: 0,
      labor_cost: 0,
      total_cost: 0,
      is_active: true
    });
    await kitRepository.save(kitElectro);
    console.log('✅ Создан набор "Электрохимичка"');

    // Создаем набор "Мини-Химичка" (пустой, заполняется вручную)
    const kitMini = kitRepository.create({
      name: 'Мини-Химичка',
      sku: 'MCHEM-001',
      description: 'Мини-набор для опытов',
      batch_size: 5000,
      reagents_cost: 0,
      equipment_cost: 0,
      print_cost: 0,
      labor_cost: 0,
      total_cost: 0,
      is_active: true
    });
    await kitRepository.save(kitMini);
    console.log('✅ Создан набор "Мини-Химичка"');

    console.log('🎉 Импорт данных завершен успешно!');
    console.log('📊 Итоговая себестоимость "Химичка": 1124,14 ₽');
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка импорта данных:', error);
    process.exit(1);
  }
}

seedCostData();
