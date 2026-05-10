from rest_framework import serializers

from .models import TestMaterial, TestQuestion, TestAnswerOption, TestAttempt, TestStudentAnswer


# =========================================================
# READ
# =========================================================

class TestAnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAnswerOption
        fields = ("id", "text", "is_correct", "order")


class TestQuestionSerializer(serializers.ModelSerializer):
    options = TestAnswerOptionSerializer(many=True, read_only=True)

    class Meta:
        model = TestQuestion
        fields = (
            "id",
            "test",
            "text",
            "question_type",
            "explanation",
            "points",
            "order",
            "options",
        )


class TestMaterialDetailSerializer(serializers.ModelSerializer):
    questions = TestQuestionSerializer(many=True, read_only=True)
    questions_count = serializers.IntegerField(source="questions.count", read_only=True)

    class Meta:
        model = TestMaterial
        fields = (
            "id",
            "material",
            "time_limit_minutes",
            "attempts_limit",
            "passing_percentage",
            "shuffle_questions",
            "show_correct_answers_after_submit",
            "questions_count",
            "questions",
        )


# =========================================================
# WRITE
# =========================================================

class TestAnswerOptionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAnswerOption
        fields = ("text", "is_correct", "order")


class TestQuestionWriteSerializer(serializers.ModelSerializer):
    options = TestAnswerOptionWriteSerializer(many=True)

    class Meta:
        model = TestQuestion
        fields = (
            "text",
            "question_type",
            "explanation",
            "points",
            "order",
            "options",
        )

    def validate(self, attrs):
        question_type = attrs.get("question_type", TestQuestion.QuestionType.SINGLE)
        options = attrs.get("options", [])

        if question_type != TestQuestion.QuestionType.SINGLE:
            raise serializers.ValidationError(
                "Поддерживается только тип вопроса 'single' (один правильный ответ)."
            )

        if len(options) != 4:
            raise serializers.ValidationError(
                {"options": "Необходимо указать ровно 4 варианта ответа."}
            )

        correct_count = sum(1 for o in options if o.get("is_correct"))
        if correct_count != 1:
            raise serializers.ValidationError(
                {"options": "Должен быть ровно один правильный ответ."}
            )

        return attrs

    def create(self, validated_data):
        options_data = validated_data.pop("options")
        test = self.context["test"]
        question = TestQuestion.objects.create(
            test=test,
            question_type=TestQuestion.QuestionType.SINGLE,
            **validated_data,
        )
        for option_data in options_data:
            TestAnswerOption.objects.create(question=question, **option_data)
        return question

    def update(self, instance, validated_data):
        options_data = validated_data.pop("options", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if options_data is not None:
            instance.options.all().delete()
            for option_data in options_data:
                TestAnswerOption.objects.create(question=instance, **option_data)

        return instance


# =========================================================
# EXCEL IMPORT
# =========================================================

class TestImportResultSerializer(serializers.Serializer):
    created_count = serializers.IntegerField()
    questions = TestQuestionSerializer(many=True)


# =========================================================
# ПРОХОЖДЕНИЕ ТЕСТА (студент)
# =========================================================

class TestAnswerOptionStudentSerializer(serializers.ModelSerializer):
    """Вариант ответа без is_correct — для студента."""

    class Meta:
        model = TestAnswerOption
        fields = ("id", "text", "order")


class TestQuestionStudentSerializer(serializers.ModelSerializer):
    """Вопрос без explanation и без is_correct в options — для студента."""

    options = TestAnswerOptionStudentSerializer(many=True, read_only=True)

    class Meta:
        model = TestQuestion
        fields = ("id", "text", "points", "order", "options")


class TestStartSerializer(serializers.ModelSerializer):
    """Ответ на начало попытки: настройки теста + вопросы без ответов."""

    questions = TestQuestionStudentSerializer(many=True, read_only=True, source="test.questions")
    time_limit_minutes = serializers.IntegerField(source="test.time_limit_minutes", read_only=True)

    class Meta:
        model = TestAttempt
        fields = (
            "id",
            "status",
            "started_at",
            "time_limit_minutes",
            "questions",
        )


class AnswerItemSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()


class TestSubmitSerializer(serializers.Serializer):
    answers = AnswerItemSerializer(many=True)

    def validate_answers(self, value):
        if not value:
            raise serializers.ValidationError("Необходимо передать хотя бы один ответ.")
        seen = set()
        for item in value:
            qid = item["question_id"]
            if qid in seen:
                raise serializers.ValidationError(
                    f"Дублирующийся ответ на вопрос {qid}."
                )
            seen.add(qid)
        return value


class TestStudentAnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="question.text", read_only=True)
    selected_option_text = serializers.CharField(source="selected_option.text", read_only=True)

    class Meta:
        model = TestStudentAnswer
        fields = (
            "question",
            "question_text",
            "selected_option",
            "selected_option_text",
            "is_correct",
        )


class TestAttemptResultSerializer(serializers.ModelSerializer):
    answers = TestStudentAnswerSerializer(many=True, read_only=True)

    class Meta:
        model = TestAttempt
        fields = (
            "id",
            "status",
            "started_at",
            "finished_at",
            "score",
            "max_score",
            "percentage",
            "is_passed",
            "grade_value",
            "answers",
        )


class TestAttemptListSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAttempt
        fields = (
            "id",
            "status",
            "started_at",
            "finished_at",
            "score",
            "max_score",
            "percentage",
            "is_passed",
            "grade_value",
        )
