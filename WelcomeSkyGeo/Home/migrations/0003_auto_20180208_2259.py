# Generated by Django 2.0.2 on 2018-02-08 17:29

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('Home', '0002_spaces'),
    ]

    operations = [
        migrations.RenameField(
            model_name='items',
            old_name='venue_id',
            new_name='venue',
        ),
    ]