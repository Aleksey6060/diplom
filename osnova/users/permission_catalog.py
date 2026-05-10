PERMISSION_CATALOG = [
    {
        "code": "store_settings",
        "title": "Настройка магазина",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "store.cards.create", "title": "Создание карточки"},
            {"code": "store.cards.edit", "title": "Редактирование карточки"},
            {"code": "store.cards.delete", "title": "Удаление карточки"},
        ],
    },
    {
        "code": "banner",
        "title": "Управление банером",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "banner.image.upload", "title": "Загрузка фотографии для банера"},
            {"code": "banner.visibility.toggle", "title": "Включение и выключение банера"},
        ],
    },
    {
        "code": "courses",
        "title": "Курсы",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "courses.view", "title": "Просмотр курсов"},
            {"code": "courses.create", "title": "Управление курсами"},
            {"code": "courses.semesters.create", "title": "Управление семестрами"},
            {"code": "courses.subjects.create", "title": "Управление предметами"},
            {"code": "courses.topics.create", "title": "Управление темами"},
            {"code": "courses.materials.create", "title": "Управление материалами"},
            {"code": "courses.folders.create", "title": "Управление папками"},
            {"code": "courses.files.create", "title": "Управление файлами"},
            {"code": "courses.tests.create", "title": "Создание тестов"},
            {"code": "courses.tests.edit", "title": "Редактирование тестов"},
        ],
    },
    {
        "code": "employees",
        "title": "Сотрудники",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "employees.roles.view", "title": "Просмотр всех ролей"},
            {"code": "employees.roles.delete", "title": "Удаление ролей из списка"},
            {"code": "employees.roles.create", "title": "Создание ролей"},
            {"code": "employees.roles.configure", "title": "Гибкая настройка ролей при создании"},
            {"code": "employees.staff.view", "title": "Просмотр сотрудников"},
            {"code": "employees.staff.create", "title": "Создание сотрудника"},
            {"code": "employees.staff.edit", "title": "Редактирование данных сотрудника"},
            {"code": "employees.staff.remove", "title": "Удаление сотрудника"},
        ],
    },
    {
        "code": "distribution",
        "title": "Распределение",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "distribution.groups.create", "title": "Создание групп"},
            {"code": "distribution.students.create", "title": "Создание учащихся"},
            {"code": "distribution.students.edit", "title": "Обновление данных учегося"},
            {"code": "distribution.students.remove", "title": "Удаление учащегося"},
            {"code": "distribution.students.credentials.edit", "title": "Редактирование учащихся (логин, пароль)"},
            {"code": "distribution.students.sensitive_data.view", "title": "Просмотр информации об учащихся"},
            {"code": "distribution.students.groups.add", "title": "Присоединение учащихся к группам"},
            {"code": "distribution.students.groups.remove", "title": "Удаление учащихся из групп"},

            {"code": "distribution.course.groups.view", "title": "Просмотр груп курса"},
            {"code": "distribution.course.groups.create", "title": "Создание группы на курсе"},
            {"code": "distribution.course.groups.remove", "title": "Удаления группы с курса"},

            {"code": "distribution.teacher.course.view", "title": "Просмотр учителей для конкретной группы на курсе"},
            {"code": "distribution.teacher.course.create", "title": "Создание учителя для конкретной группы на курсе"},
            {"code": "distribution.teacher.course.remove", "title": "Удаления учителя для конкретной группы на курсе"},

        ],
    },
    {
        "code": "students",
        "title": "Учащиеся",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "students.groups.view", "title": "Просмотр групп студентов и слушателей"},
            {"code": "students.groups.create", "title": "Создание групп студентов и слушателей"},
            {"code": "students.groups.edit", "title": "Изменение групп студентов и слушателей"},
            {"code": "students.groups.delete", "title": "Удаление групп студентов и слушателей"},
            {"code": "students.schedule.manage", "title": "Управление расписанием"},

            {"code": "students.progress.group.view", "title": "Просмотр табеля всей группы"},
            {"code": "students.progress.single.view", "title": "Просмотр успеваемости учащегося"},
            {"code": "students.courses.add", "title": "Добавление курса учащемуся"},
        ],
    },
    {
        "code": "grades",
        "title": "Оценки",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "grades.assignments.view", "title": "Просмотр заданий"},
            {"code": "grades.assignments.create", "title": "Создание заданий"},
            {"code": "grades.assignments.edit", "title": "Редактирование заданий"},
            {"code": "grades.assignments.delete", "title": "Удаление заданий"},
            {"code": "grades.set", "title": "Выставление оценок"},
            {"code": "grades.export", "title": "Выгрузка оценок в Excel"},
        ],
    },
    {
        "code": "payments",
        "title": "Оплата",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "payments.view_all", "title": "Просмотр информации об оплате всех студентов"},
            {"code": "payments.notifications.send", "title": "Рассылка сообщения о приближающейся дате оплаты"},
        ],
    },
    {
        "code": "documents",
        "title": "Документы",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "documents.files.upload", "title": "Загрузка файлов"},
            {"code": "documents.files.delete", "title": "Удаление файлов"},
        ],
    },
    {
        "code": "chats",
        "title": "Чаты",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "chats.all.view", "title": "Просмотр всех чатов"},
            {"code": "chats.assigned.view", "title": "Просмотр чатов с преподавателями"},
            {"code": "chats.messages.send", "title": "Отправка сообщений преподавателям"},
        ],
    },
    {
        "code": "applications",
        "title": "Принятие заявок",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "applications.all.view", "title": "Просмотр всех заявок"},
            {"code": "applications.take_in_work", "title": "Принятие обращения в обработку"},
            {"code": "applications.templates.view", "title": "Просмотр шаблонов"},
            {"code": "applications.templates.manage", "title": "Управление шаблонами"},
        ],
    },
    {
        "code": "profile_access",
        "title": "Доступ к профилю",
        "allow_partial_permissions": True,
        "actions": [
            {"code": "profile.required_documents.edit", "title": "Редактирование требуемых документов"},
        ],
    },
    {
        "code": "design",
        "title": "Оформление",
        "allow_partial_permissions": False,
        "actions": [
            {"code": "design.access", "title": "Доступ к вкладке оформления"},
        ],
    },
]
