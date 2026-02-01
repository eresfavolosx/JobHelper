import KanbanBoard from '@/components/KanbanBoard';

export default function KanbanPage() {
    return (
        <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>Application Board</h2>
            <KanbanBoard />
        </div>
    );
}
