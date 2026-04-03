"use client";
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '50vh',
                    textAlign: 'center',
                    padding: '40px 20px'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px'
                    }}>
                        <AlertTriangle size={40} color="var(--error)" />
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>
                        Something went wrong
                    </h2>

                    <p style={{
                        color: 'var(--text-secondary)',
                        marginBottom: '24px',
                        maxWidth: '400px',
                        lineHeight: '1.6'
                    }}>
                        We hit an unexpected error. Don't worry, your data is safe.
                        Try refreshing the page.
                    </p>

                    <button
                        onClick={this.handleReset}
                        aria-label="Refresh Page"
                        title="Refresh Page"
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <RefreshCw size={18} /> Refresh Page
                    </button>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <pre style={{
                            marginTop: '24px',
                            padding: '16px',
                            background: 'var(--glass-panel)',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            color: 'var(--error)',
                            maxWidth: '100%',
                            overflow: 'auto',
                            textAlign: 'left'
                        }}>
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
