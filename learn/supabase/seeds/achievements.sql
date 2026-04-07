INSERT INTO achievements (slug, title, description, icon_url, condition, points) VALUES
  ('first_reaction', 'Первая реакция', 'Решить первую задачу', '🧪', '{"type": "tasks_solved", "count": 1}', 10),
  ('laborant', 'Лаборант', 'Решить 50 задач', '🔬', '{"type": "tasks_solved", "count": 50}', 50),
  ('chemist', 'Химик', 'Решить 200 задач', '🧑‍🔬', '{"type": "tasks_solved", "count": 200}', 100),
  ('professor', 'Профессор', 'Решить 500 задач', '🏆', '{"type": "tasks_solved", "count": 500}', 200),
  ('week_fire', 'Неделя огня', 'Заниматься 7 дней подряд', '🔥', '{"type": "streak_days", "count": 7}', 50),
  ('month_lab', 'Месяц в лаборатории', 'Заниматься 30 дней подряд', '🔥', '{"type": "streak_days", "count": 30}', 150),
  ('no_mistakes', 'Без ошибок', 'Пройти модуль со 100% правильных с 1-й попытки', '⚡', '{"type": "perfect_module", "count": 1}', 100),
  ('first_module', 'Первый модуль', 'Завершить любой модуль', '📚', '{"type": "modules_completed", "count": 1}', 50),
  ('know_it_all', 'Всезнайка', 'Завершить все базовые модули', '🧠', '{"type": "all_base_modules", "count": 1}', 300)
ON CONFLICT (slug) DO NOTHING;
