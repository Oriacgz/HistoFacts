"""Owner-scoped session memory and explicit derived-note kinds."""
from alembic import op
import sqlalchemy as sa

revision = "session_memory"
down_revision = "research_details"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if 'kind' not in {c['name'] for c in sa.inspect(bind).get_columns('notes')}:
        op.add_column('notes',sa.Column('kind',sa.String(24),nullable=False,server_default='conversation'))
        op.execute("UPDATE notes SET kind='derived' WHERE source_note_id IS NOT NULL AND (title LIKE 'Revised:%' OR title LIKE 'Handwritten Notes:%')")
    if 'note_session_memory' not in sa.inspect(bind).get_table_names():
        op.create_table('note_session_memory',
            sa.Column('root_id',sa.String(),sa.ForeignKey('notes.id',ondelete='CASCADE'),primary_key=True),
            sa.Column('user_id',sa.String(),nullable=False,index=True),
            sa.Column('epoch',sa.Integer(),nullable=False,server_default='0'),
            sa.Column('version',sa.Integer(),nullable=False,server_default='0'),
            sa.Column('enabled',sa.Boolean(),nullable=False,server_default=sa.true()),
            *[sa.Column(name,sa.JSON(),nullable=False,server_default=sa.text("'[]'")) for name in ('summary','covered_ids','ignored_ids','snapshots')],
            sa.Column('retrieval',sa.JSON(),nullable=False,server_default=sa.text("'{}'")),
            sa.Column('status',sa.String(24),nullable=False,server_default='ready'),
            sa.Column('operation_id',sa.String()),sa.Column('lease_until',sa.DateTime(timezone=True)),
            sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()))


def downgrade():
    op.drop_table('note_session_memory')
    op.drop_column('notes','kind')
